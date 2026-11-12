import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01_TITLE } from '../footage';

/**
 * E06-F05 preview/render parity on a REAL project: S01 at 12:00 (two video elements, one zoomed), a Thai title
 * with a pop-in, and caption pages built from the real transcript. The same frames are captured from the editor
 * stage (`/dev/stage/:id`, proxy media, lossless screenshot) and decoded from the exported MP4 (originals, H.264),
 * then compared with ffmpeg SSIM. Part of the render gate of both repos (needs the full dev stack).
 */
const FOOTAGE = fileURLToPath(new URL('../../../../../footage', import.meta.url));
const OUT = fileURLToPath(new URL('../../test-results/parity', import.meta.url));
test.skip(!existsSync(`${FOOTAGE}/MANIFEST.md`), 'workspace footage not available');
test.describe.configure({ timeout: 420_000 });
test.use({ viewport: { width: 1200, height: 2000 } });

const FPS = 30;
const FROM_MS = 720_000;
const LEN = 360;
const SAMPLES = [5, 40, 90, 150, 200, 239, 240, 310, 355];
const MIN_SSIM = 0.95;
const u = (n: number) => `00000000-0000-7000-8000-${String(n + 500).padStart(12, '0')}`;

type Word = { text: string; startMs: number; endMs: number };

async function s01(page: Page) {
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  const src = readySource(list.items, S01_TITLE);
  test.skip(!src, 'S01 is not ingested in this dev database');
  const seg = (await (
    await page.request.get(`/api/sources/${src?.id}/transcript/segments?from=0&limit=1000`)
  ).json()) as { items: { startMs: number; endMs: number; words: Word[] }[] };
  const words = seg.items
    .filter((s) => s.startMs >= FROM_MS && s.endMs <= FROM_MS + (LEN / FPS) * 1000)
    .flatMap((s) => s.words)
    .map((w) => ({
      text: w.text,
      startFrame: Math.round(((w.startMs - FROM_MS) * FPS) / 1000),
      endFrame: Math.round(((w.endMs - FROM_MS) * FPS) / 1000),
    }))
    .filter((w) => w.endFrame > w.startFrame);
  return { sourceId: src?.id ?? '', words };
}

/** ffmpeg SSIM (Y/U/V weighted "All"); the summary is printed on stderr. */
const ssim = (a: string, b: string): number => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  return Number(/All:([\d.]+)/.exec(r.stderr)?.[1] ?? Number.NaN);
};

test('sampled frames of the exported MP4 match the editor preview (SSIM ≥ 0.95)', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await signIn(page, '/library');
  const { sourceId, words } = await s01(page);
  expect(words.length).toBeGreaterThan(10);
  const tf = (y: number, scale = 1) => ({ x: 0, y, scale, rotation: 0 });
  const video = (id: number, start: number, len: number, inFrame: number, scale: number) => ({
    type: 'video',
    id: u(id),
    trackId: u(10),
    startFrame: start,
    durationFrames: len,
    origin: 'user',
    assetId: u(1),
    sourceInFrame: inFrame,
    playbackRate: 1,
    volume: 1,
    transform: tf(0, scale),
    fit: 'cover',
  });
  const doc = {
    schemaVersion: 1,
    fps: { num: FPS, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: LEN,
    assets: { [u(1)]: { sourceId, kind: 'video', durationFrames: 81_000, hasAudio: true } },
    tracks: [
      { id: u(10), kind: 'video', elementIds: [u(20), u(21)] },
      { id: u(11), kind: 'overlay', elementIds: [u(30)] },
      { id: u(12), kind: 'caption', elementIds: [] as string[] },
    ],
    elements: {
      [u(20)]: video(20, 0, 240, (FROM_MS / 1000) * FPS, 1),
      [u(21)]: video(21, 240, 120, (FROM_MS / 1000) * FPS + 240, 1.3),
      [u(30)]: {
        type: 'text',
        id: u(30),
        trackId: u(11),
        startFrame: 0,
        durationFrames: LEN,
        origin: 'user',
        content: `เสื้อมัดย้อม ฿390 · ${Date.now() % 100000}`,
        styleRef: 'title',
        transform: tf(-620),
        animationIn: { presetId: 'pop', durationFrames: 12 },
      },
    } as Record<string, unknown>,
    meta: { createdBy: 'user', title: 'parity' },
  };
  const created = await page.request.post('/api/projects', { data: { title: 'parity', doc } });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;

  // real caption pages, laid out in the browser with the bundled font
  await page.goto(`/dev/stage/${id}`);
  await page.waitForFunction(() => !!window.__stageLib);
  const pages = await page.evaluate(async (ws) => {
    const lib = window.__stageLib;
    if (!lib) throw new Error('no stage lib');
    await lib.loadCaptionFont(lib.captionFont('bold-highlight'));
    return lib.buildCaptions(ws, {
      measure: lib.canvasMeasure(lib.captionFont('bold-highlight')),
      maxWidth: lib.captionMaxWidth(1080),
      maxLines: 2,
      pauseFrames: 15,
    });
  }, words);
  pages.forEach((pg, i) => {
    const cid = u(100 + i);
    doc.tracks[2]?.elementIds.push(cid);
    doc.elements[cid] = {
      type: 'caption',
      id: cid,
      trackId: u(12),
      startFrame: pg.startFrame,
      durationFrames: pg.durationFrames,
      origin: 'user',
      words: pg.words,
      lines: pg.lines,
      styleRef: 'bold-highlight',
      transform: tf(520),
    };
  });
  const saved = await page.request.put(`/api/projects/${id}`, { data: { baseVersion: 1, doc } });
  expect(saved.status(), await saved.text()).toBe(200);

  // export (originals) and wait for it
  const req = await page.request.post(`/api/projects/${id}/renders`, { data: { preset: 'standard' } });
  const renderId = ((await req.json()) as { id: string }).id;
  await expect
    .poll(
      async () =>
        ((await (await page.request.get(`/api/renders/${renderId}`)).json()) as { status: string }).status,
      {
        timeout: 300_000,
        intervals: [2000],
      },
    )
    .toBe('ready');
  const mp4 = `${OUT}/render.mp4`;
  writeFileSync(mp4, await (await page.request.get(`/api/renders/${renderId}/file`)).body());
  for (const f of SAMPLES) {
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      mp4,
      '-vf',
      `select=eq(n\\,${f})`,
      '-fps_mode',
      'passthrough',
      '-frames:v',
      '1',
      `${OUT}/render-${f}.png`,
    ]);
  }

  /** The editor stage at full size, lossless screenshots of the same frames with `media` files. */
  const capture = async (media: 'original' | 'proxy') => {
    await page.goto(`/dev/stage/${id}${media === 'original' ? '?media=original' : ''}`);
    await page.waitForFunction(() => !!window.__stage);
    await page.evaluate(() => window.__stage?.ready());
    const host = page.getByTestId('stage-host');
    const out: { frame: number; ssim: number }[] = [];
    for (const f of SAMPLES) {
      await page.evaluate((frame) => window.__stage?.seek(frame), f);
      const shot = `${OUT}/preview-${media}-${f}.png`;
      await host.screenshot({ path: shot });
      out.push({ frame: f, ssim: ssim(shot, `${OUT}/render-${f}.png`) });
    }
    return out;
  };
  // gate: same compositor, same media → what is left is capture + H.264 encode
  const same = await capture('original');
  // documented, not gated: the editor normally previews 30 fps proxies (re-encoded), the export reads originals
  const proxy = await capture('proxy');
  console.log(
    `parity render ${renderId}\n  originals: ${JSON.stringify(same)}\n  proxies:   ${JSON.stringify(proxy)}`,
  );
  for (const r of same) expect(r.ssim, `frame ${r.frame}`).toBeGreaterThanOrEqual(MIN_SSIM);
  for (const r of proxy) expect(r.ssim, `frame ${r.frame} (proxy)`).toBeGreaterThan(0.85); // same picture, never a different frame
});
