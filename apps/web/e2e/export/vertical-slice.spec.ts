import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

/**
 * E06 epic gate — the vertical slice, end to end through the UI on REAL footage (C02, 55 s live selling clip):
 * upload → ingest → transcribe → correct a word → select words → create clip (captions carry the correction)
 * → export → the worker is killed (SIGKILL) mid-render and restarted → the render still finishes exactly once
 * → download → the file plays with the clip's duration. Needs the dev stack started by `scripts/dev.sh`.
 */
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const CLIP = `${ROOT}footage/clips/live-tiedye-th-vertical-b.mp4`;
test.skip(!existsSync(CLIP), 'workspace footage not available');
test.describe.configure({ timeout: 900_000 });

const workerPid = () => Number(readFileSync(`${ROOT}logs/dev/worker.pid`, 'utf8').trim());
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** Headless Chromium processes whose parent died (re-parented to launchd, ppid 1) = orphans of a killed worker. */
const orphanShells = () =>
  execFileSync('ps', ['-A', '-o', 'ppid=,command='], { encoding: 'utf8' })
    .split('\n')
    .filter((l) => /^\s*1\s/.test(l) && l.includes('chrome-headless-shell')).length;

test('upload → transcribe → fix a word → clip → export, worker killed mid-render → done once → download', async ({
  page,
}) => {
  await signIn(page, '/library');
  expect(orphanShells()).toBe(0);

  // 1. upload + ingest
  const handedOver = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await page.getByTestId('upload-input').setInputFiles(CLIP);
  const sourceId = ((await (await handedOver).json()) as { id: string }).id;
  await page.goto(`/library/${sourceId}`);

  // 2. transcribe from the UI
  await expect(page.getByTestId('transcript-start')).toBeVisible({ timeout: 180_000 });
  await page.getByTestId('transcript-start').click();
  const words = page.locator('[data-testid="transcript"] [data-w]');
  await expect(words.first()).toBeVisible({ timeout: 300_000 });

  // 3. correct a word (the caption editor arrives with Quick Edit; captions are built from the corrected transcript)
  const target = page.locator('[data-testid="transcript"] [data-w="6"]');
  const before = (await target.textContent()) ?? '';
  const fixed = `${before}ค่ะ`;
  await target.dblclick();
  await page.getByTestId('word-editor').fill(fixed);
  await page.getByTestId('word-editor').press('Enter');
  await expect(target).toHaveText(fixed);

  // 4. select words 2…14 → create the clip
  const a = page.locator('[data-testid="transcript-scroll"] [data-w="2"]');
  const b = page.locator('[data-testid="transcript-scroll"] [data-w="14"]');
  const ab = await a.boundingBox();
  const bb = await b.boundingBox();
  if (!ab || !bb) throw new Error('no word boxes');
  await page.mouse.move(ab.x + 1, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2, { steps: 3 });
  await page.mouse.move(bb.x + bb.width - 1, bb.y + bb.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.getByTestId('clip-create').click();
  await expect(page).toHaveURL(/\/clips\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const projectId = page.url().split('/').pop() ?? '';
  const rec = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as {
    doc: {
      fps: { num: number; den: number };
      durationFrames: number;
      elements: Record<string, { type: string; words?: { text: string }[] }>;
    };
  };
  const captionWords = Object.values(rec.doc.elements).flatMap((e) =>
    e.type === 'caption' ? (e.words ?? []) : [],
  );
  expect(captionWords.map((w) => w.text)).toContain(fixed);
  const durationSec = (rec.doc.durationFrames * rec.doc.fps.den) / rec.doc.fps.num;

  // 5. export; kill the worker once while it renders
  await page.getByTestId('export-button').click();
  const row = page.getByTestId('render-row').first();
  await expect(row).toHaveAttribute('data-status', 'rendering', { timeout: 120_000 });
  await expect
    .poll(async () => Number(await row.getByRole('progressbar').getAttribute('aria-valuenow')), {
      timeout: 120_000,
    })
    .toBeGreaterThan(20);
  const renderId = (await row.getAttribute('data-render-id')) ?? '';
  const killed = workerPid();
  process.kill(killed, 'SIGKILL');
  await expect.poll(() => alive(killed)).toBe(false);
  await page.screenshot({ path: 'test-results/slice-worker-killed.png' });
  execFileSync(`${ROOT}scripts/dev.sh`, ['start'], { stdio: 'ignore' }); // starts only what is not running
  expect(workerPid()).not.toBe(killed);

  // 6. it still finishes — exactly once
  await expect(row).toHaveAttribute('data-status', 'ready', { timeout: 600_000 });
  const render = (await (await page.request.get(`/api/renders/${renderId}`)).json()) as {
    runId: string;
    sizeBytes: number;
  };
  const run = (await (await page.request.get(`/api/workflow-runs/${render.runId}`)).json()) as {
    status: string;
    jobs: { type: string; status: string; attempts: number }[];
  };
  console.log(`slice: render ${renderId} run ${JSON.stringify(run)}`);
  expect(run.status).toBe('succeeded');
  expect(run.jobs).toHaveLength(1);
  expect(run.jobs[0]).toMatchObject({ type: 'render.video', status: 'succeeded', attempts: 2 });
  await page.screenshot({ path: 'test-results/slice-ready.png', fullPage: true });

  // 7. download + play
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    row.getByTestId('render-download').click(),
  ]);
  expect(statSync(await download.path()).size).toBe(render.sizeBytes);
  const played = await page.evaluate(async (src) => {
    const v = document.createElement('video');
    v.muted = true;
    v.src = src;
    await new Promise<void>((res, rej) => {
      v.addEventListener('loadedmetadata', () => res(), { once: true });
      v.addEventListener('error', () => rej(new Error('video error')), { once: true });
    });
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
  }, `/api/renders/${renderId}/file`);
  console.log(`slice: played ${JSON.stringify(played)} expected ${durationSec.toFixed(3)} s`);
  expect(played).toMatchObject({ w: 1080, h: 1920 });
  expect(Math.abs(played.duration - durationSec)).toBeLessThan(0.05);
  // no Chromium left behind by the killed worker
  await expect.poll(orphanShells, { timeout: 10_000 }).toBe(0);
});
