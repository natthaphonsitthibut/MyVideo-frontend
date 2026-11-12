import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01_TITLE } from '../footage';

/**
 * Preview player perf scenario (editor-performance budgets) on a REAL 3-layer project: S01 video + captions built
 * from its real transcript + a text overlay. Measures frame times and long tasks while playing and scrubbing,
 * drift of the video against the master clock, and React commits during playback.
 */
const FOOTAGE = fileURLToPath(new URL('../../../../../footage', import.meta.url));
test.skip(!existsSync(`${FOOTAGE}/MANIFEST.md`), 'workspace footage not available');
test.describe.configure({ timeout: 240_000 });

const FPS = 30;
const FROM_MS = 720_000;
const LEN = 600;
const SRC_IN = (FROM_MS / 1000) * FPS;

test('3-layer real project: smooth playback and scrub, video on the clock, zero React commits while playing', async ({
  page,
}) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  const s01 = readySource(list.items, S01_TITLE);
  test.skip(!s01, 'S01 is not ingested in this dev database');
  const seg = (await (
    await page.request.get(`/api/sources/${s01?.id}/transcript/segments?from=0&limit=1000`)
  ).json()) as {
    items: { startMs: number; endMs: number; words: { text: string; startMs: number; endMs: number }[] }[];
  };
  const words = seg.items
    .filter((s) => s.startMs >= FROM_MS && s.endMs <= FROM_MS + (LEN / FPS) * 1000)
    .flatMap((s) => s.words)
    .map((w) => ({
      text: w.text,
      startFrame: Math.round(((w.startMs - FROM_MS) * FPS) / 1000),
      endFrame: Math.round(((w.endMs - FROM_MS) * FPS) / 1000),
    }))
    .filter((w) => w.endFrame > w.startFrame);

  const u = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const tf = (y: number) => ({ x: 0, y, scale: 1, rotation: 0 });
  const doc = {
    schemaVersion: 1,
    fps: { num: FPS, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: LEN,
    assets: { [u(1)]: { sourceId: s01?.id, kind: 'video', durationFrames: 81_000, hasAudio: true } },
    tracks: [
      { id: u(10), kind: 'video', elementIds: [u(20)] },
      { id: u(11), kind: 'caption', elementIds: [] as string[] },
      { id: u(12), kind: 'overlay', elementIds: [u(30)] },
    ],
    elements: {
      [u(20)]: {
        type: 'video',
        id: u(20),
        trackId: u(10),
        startFrame: 0,
        durationFrames: LEN,
        origin: 'ai',
        assetId: u(1),
        sourceInFrame: SRC_IN,
        playbackRate: 1,
        volume: 1,
        transform: tf(0),
        fit: 'cover',
      },
      [u(30)]: {
        type: 'text',
        id: u(30),
        trackId: u(12),
        startFrame: 0,
        durationFrames: LEN,
        origin: 'ai',
        content: words
          .slice(0, 3)
          .map((w) => w.text)
          .join(''),
        styleRef: 'title',
        transform: tf(-640),
        animationIn: { presetId: 'pop', durationFrames: 12 },
      },
    } as Record<string, unknown>,
    meta: { createdBy: 'user', title: 'player perf test' },
  };
  const created = await page.request.post('/api/projects', { data: { title: 'player perf', doc } });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;

  await page.goto(`/dev/player/${id}`);
  await page.waitForFunction(() => !!window.__player && !!window.__stageLib);
  const pages = await page.evaluate(async (ws) => {
    const lib = window.__stageLib;
    if (!lib) throw new Error('no lib');
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
    doc.tracks[1]?.elementIds.push(cid);
    doc.elements[cid] = {
      type: 'caption',
      id: cid,
      trackId: u(11),
      startFrame: pg.startFrame,
      durationFrames: pg.durationFrames,
      origin: 'ai',
      words: pg.words,
      lines: pg.lines,
      styleRef: 'bold-highlight',
      transform: tf(520),
    };
  });
  expect((await page.request.put(`/api/projects/${id}`, { data: { baseVersion: 1, doc } })).status()).toBe(
    200,
  );
  await page.reload();
  await page.waitForFunction(() => !!window.__player);
  await page.waitForTimeout(1500); // proxies + fonts warm

  // --- playback: 5 s of rAF deltas, long tasks, drift samples, React commits
  await page.evaluate(() => {
    const w = window as unknown as {
      __perf: { deltas: number[]; long: number[]; drift: number[]; on: boolean };
    };
    w.__perf = { deltas: [], long: [], drift: [], on: true };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration);
    }).observe({ type: 'longtask' });
  });
  await page.getByTestId('preview-toggle').click();
  await page.waitForFunction(() => window.__player?.playing === true);
  await page.waitForTimeout(300); // let the start settle, then measure
  const commitsAtStart = await page.evaluate(() => window.__commits ?? 0);
  await page.evaluate(
    ({ srcIn, fps }) => {
      const w = window as unknown as { __perf: { deltas: number[]; drift: number[]; on: boolean } };
      let last = performance.now();
      const loop = (t: number) => {
        w.__perf.deltas.push(t - last);
        last = t;
        const v = document.querySelector<HTMLVideoElement>('[data-testid="preview-stage"] video');
        const p = window.__player;
        // video frame (from its own clock) vs the master-clock frame the stage is drawing
        if (v && p?.playing) w.__perf.drift.push(Math.round(v.currentTime * fps - srcIn) - p.frame);
        if (w.__perf.on) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    { srcIn: SRC_IN, fps: FPS },
  );
  await page.waitForTimeout(5000);
  const commitsDuring = (await page.evaluate(() => window.__commits ?? 0)) - commitsAtStart;
  const play = await page.evaluate(() => {
    const w = window as unknown as {
      __perf: { deltas: number[]; long: number[]; drift: number[]; on: boolean };
    };
    w.__perf.on = false;
    const d = w.__perf.deltas.slice(2).sort((a, b) => a - b);
    const drift = w.__perf.drift
      .slice(5)
      .map(Math.abs)
      .sort((a, b) => a - b);
    return {
      frames: d.length,
      p95: d[Math.floor(d.length * 0.95)] ?? 0,
      long: w.__perf.long.filter((x) => x > 50),
      driftP95: drift[Math.floor(drift.length * 0.95)] ?? 99,
      driftMax: drift[drift.length - 1] ?? 99,
      frame: window.__player?.frame ?? 0,
    };
  });
  await page.screenshot({ path: 'test-results/player-playing.png' });
  await page.getByTestId('preview-toggle').click();
  await page.waitForFunction(() => window.__player?.playing === false);
  console.log(`playback ${JSON.stringify(play)} · React commits during playback ${commitsDuring}`);
  expect(play.frame).toBeGreaterThan(130); // ~5 s at 30 fps really advanced
  expect(play.p95).toBeLessThanOrEqual(20);
  expect(play.long).toEqual([]);
  expect(play.driftP95).toBeLessThanOrEqual(1);
  expect(commitsDuring).toBe(0);

  // --- scrub: 3 s drag across the track, frame times + correct frame shown after release
  const track = page.getByTestId('preview-track');
  const box = await track.boundingBox();
  if (!box) throw new Error('no track');
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; long: number[]; on: boolean } };
    w.__perf = { deltas: [], long: [], on: true };
    let last = performance.now();
    const loop = (t: number) => {
      w.__perf.deltas.push(t - last);
      last = t;
      if (w.__perf.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 90; i++) {
    await page.mouse.move(box.x + 2 + ((box.width - 4) * i) / 90, box.y + box.height / 2);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const scrub = await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; on: boolean } };
    w.__perf.on = false;
    const d = w.__perf.deltas.slice(2).sort((a, b) => a - b);
    return { p95: d[Math.floor(d.length * 0.95)] ?? 0, frame: window.__player?.frame ?? -1 };
  });
  console.log(`scrub ${JSON.stringify(scrub)}`);
  // latest seek wins: the frame shown is the one under the pointer at release (x = right edge − 2 px)
  const releaseFrame = Math.round(((box.width - 2) / box.width) * (LEN - 1));
  expect(scrub.frame).toBe(releaseFrame);
  expect(scrub.p95).toBeLessThanOrEqual(20);
  await page.screenshot({ path: 'test-results/player-scrubbed.png' });
});
