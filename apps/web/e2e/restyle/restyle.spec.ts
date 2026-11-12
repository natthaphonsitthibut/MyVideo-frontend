import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01A_TITLE } from '../footage';

/**
 * Style switching on a REAL AI clip (S01a = 10 min of the S01 Thai live-selling recording, already ingested and
 * transcribed in the dev database): a fresh live-to-clips run in the "sale-fast" style (jump cuts, zoom cuts,
 * sound effects) → the preview plays the jump-cut project smoothly on one shared video node and the sound
 * effects load → the clip page switches it to "premium" → new version, preview shows it. Runs in the dev
 * worker's LLM_MODE (repeat runs answer from the LLM cache). Needs the dev stack started by `scripts/dev.sh`.
 */
test.describe.configure({ timeout: 600_000, mode: 'serial' });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/restyle-${name}.png`, fullPage: true });

type Clips = {
  runId: string;
  status: string;
  clips: { rank: number; status: string; projectId: string | null }[];
};

test('AI clip: jump-cut preview plays smoothly, then switch its style without re-running AI', async ({
  page,
}) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  const s01a = readySource(list.items, S01A_TITLE);
  test.skip(!s01a, 'S01a is not ingested in this dev database');
  const sourceId = s01a?.id ?? '';

  // a fresh run in the sale-fast style (stores the build inputs a restyle needs)
  const started = (await (
    await page.request.post(`/api/sources/${sourceId}/clips`, {
      data: { productName: 'Liquid Blue', fresh: true, styleId: 'sale-fast' },
    })
  ).json()) as Clips;
  let state = started;
  await expect
    .poll(
      async () => {
        state = (await (await page.request.get(`/api/sources/${sourceId}/clips`)).json()) as Clips;
        return state.runId === started.runId ? state.status : 'other';
      },
      { timeout: 300_000, intervals: [2000] },
    )
    .toBe('succeeded');
  const projectId = state.clips.find((c) => c.status === 'ready')?.projectId ?? '';
  expect(projectId).not.toBe('');
  const v1 = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as {
    version: number;
    doc: {
      meta: { styleId: string };
      elements: Record<string, { type: string; assetId?: string }>;
      assets: Record<string, { sourceId?: string; libraryId?: string }>;
    };
  };
  expect(v1.doc.meta.styleId).toBe('sale-fast');
  const videoEls = Object.values(v1.doc.elements).filter((e) => e.type === 'video').length;
  const sounds = Object.values(v1.doc.assets).filter((a) => a.libraryId).length;
  expect(videoEls).toBeGreaterThan(3); // jump/zoom cuts = several video elements on one source
  expect(sounds).toBeGreaterThan(0);

  // --- preview of the jump-cut project: 5 s of frame times, long tasks; sounds load from the library route
  const soundStatuses: number[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/library/sounds/')) soundStatuses.push(r.status());
  });
  await page.goto(`/dev/player/${projectId}`);
  await page.waitForFunction(() => !!window.__player);
  await page.waitForTimeout(1500); // proxies + fonts warm
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; long: number[]; on: boolean } };
    w.__perf = { deltas: [], long: [], on: true };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration);
    }).observe({ type: 'longtask' });
  });
  await page.getByTestId('preview-toggle').click();
  await page.waitForFunction(() => window.__player?.playing === true);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; on: boolean } };
    let last = performance.now();
    const loop = (t: number) => {
      w.__perf.deltas.push(t - last);
      last = t;
      if (w.__perf.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.waitForTimeout(5000);
  const play = await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; long: number[]; on: boolean } };
    w.__perf.on = false;
    const d = w.__perf.deltas.slice(2).sort((a, b) => a - b);
    return {
      frames: d.length,
      p95: d[Math.floor(d.length * 0.95)] ?? 0,
      max: d[d.length - 1] ?? 0,
      long: w.__perf.long.filter((x) => x > 50),
      frame: window.__player?.frame ?? 0,
      videos: document.querySelectorAll('[data-testid="preview-stage"] video').length,
    };
  });
  await shot(page, '1-jumpcut-playing');
  await page.getByTestId('preview-toggle').click();
  console.log(
    `jump-cut playback ${JSON.stringify(play)} · library sound responses ${soundStatuses.join(',')}`,
  );
  expect(play.frame).toBeGreaterThan(130); // ~5 s at 30 fps really advanced across several cuts
  expect(play.p95).toBeLessThanOrEqual(20);
  expect(play.long).toEqual([]);
  expect(play.videos).toBe(1); // one shared node for the whole same-source run of cuts
  expect(soundStatuses.length).toBeGreaterThan(0);
  expect(soundStatuses.every((s) => s === 200 || s === 206)).toBe(true);

  // --- restyle on the clip page
  await page.goto(`/clips/${projectId}`);
  const picker = page.getByTestId('style-picker');
  await expect(picker).toBeVisible({ timeout: 30_000 });
  await expect(picker.locator('label')).toHaveCount(5);
  await expect(page.getByTestId('style-sale-fast')).toHaveAttribute('data-selected', 'true');
  await shot(page, '2-picker');

  await page.getByTestId('style-premium').click();
  await expect(page.getByTestId('restyle-working')).toBeVisible();
  await expect(page.getByTestId('style-premium')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('restyle-working')).toHaveCount(0, { timeout: 120_000 });
  await expect(page.getByText(`เวอร์ชัน ${v1.version + 1}`)).toBeVisible();
  await expect(page.getByTestId('style-premium')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('alert')).toHaveCount(0);

  const v2 = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as {
    version: number;
    doc: { meta: { styleId: string } };
  };
  expect([v2.version, v2.doc.meta.styleId]).toEqual([v1.version + 1, 'premium']);
  const versions = (await (await page.request.get(`/api/projects/${projectId}/versions`)).json()) as {
    items: { version: number; reason: string }[];
  };
  expect(versions.items[0]).toMatchObject({ version: v1.version + 1, reason: 'restyle' });

  // the preview on the clip page plays the new version
  const time = () => page.getByTestId('preview-track').getAttribute('aria-valuenow');
  const before = await time();
  await page.getByTestId('preview-toggle').click();
  await expect.poll(time, { timeout: 10_000 }).not.toBe(before);
  await page.getByTestId('preview-toggle').click();
  await shot(page, '3-restyled');
});
