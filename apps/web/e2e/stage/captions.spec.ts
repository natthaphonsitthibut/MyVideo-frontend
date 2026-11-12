import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01_TITLE } from '../footage';

/**
 * Captions on a REAL Thai transcript excerpt (S01 12:00–12:20): lines are built in the browser with the bundled
 * font (measured greedy fill), stored in the project via the API, and rendered by the stage. Checks: no line
 * overflows its box (no browser re-wrap), the highlight switches exactly on each word's first frame.
 */
const FOOTAGE = fileURLToPath(new URL('../../../../../footage', import.meta.url));
test.skip(!existsSync(`${FOOTAGE}/MANIFEST.md`), 'workspace footage not available');
test.describe.configure({ timeout: 240_000 });
test.use({ viewport: { width: 1200, height: 2000 } });

const FPS = 30;
const FROM_MS = 720_000;
const LEN = 600; // 20 s

type Word = { text: string; startMs: number; endMs: number };
type Page2 = {
  startFrame: number;
  durationFrames: number;
  words: { text: string; startFrame: number; endFrame: number }[];
  lines: number[][];
};

async function realWords(page: Page) {
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  const s01 = readySource(list.items, S01_TITLE);
  test.skip(!s01, 'S01 is not ingested in this dev database');
  const seg = (await (
    await page.request.get(`/api/sources/${s01?.id}/transcript/segments?from=0&limit=1000`)
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
  expect(words.length).toBeGreaterThan(20);
  return { sourceId: s01?.id ?? '', words };
}

test('real Thai captions: stored lines never re-wrap; highlight follows word frames exactly', async ({
  page,
}) => {
  await signIn(page, '/library');
  const { sourceId, words } = await realWords(page);
  const u = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const doc = {
    schemaVersion: 1,
    fps: { num: FPS, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: LEN,
    assets: { [u(1)]: { sourceId, kind: 'video', durationFrames: 81_000, hasAudio: true } },
    tracks: [
      { id: u(10), kind: 'video', elementIds: [u(20)] },
      { id: u(11), kind: 'caption', elementIds: [] as string[] },
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
        sourceInFrame: (FROM_MS / 1000) * FPS,
        playbackRate: 1,
        volume: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        fit: 'cover',
      },
    } as Record<string, unknown>,
    meta: { createdBy: 'user', title: 'caption test' },
  };
  const created = await page.request.post('/api/projects', { data: { title: 'caption test', doc } });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;

  // build caption pages in the browser with the real font
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
  expect(pages.length).toBeGreaterThan(2);

  pages.forEach((pg: Page2, i: number) => {
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
      transform: { x: 0, y: 520, scale: 1, rotation: 0 },
    };
  });
  const saved = await page.request.put(`/api/projects/${id}`, { data: { baseVersion: 1, doc } });
  expect(saved.status(), await saved.text()).toBe(200);

  await page.reload();
  await page.waitForFunction(() => !!window.__stage);
  await page.evaluate(() => window.__stage?.ready());

  // 1) every stored line fits its box: nothing clipped, nothing re-wrapped
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-caption] div > div')].map((r) => ({
      text: r.textContent,
      fits: r.scrollWidth <= (r.parentElement?.clientWidth ?? 0) + 1,
      oneLine: r.getClientRects().length === 1 && r.offsetHeight < 150,
    })),
  );
  expect(rows.length).toBeGreaterThan(pages.length);
  for (const r of rows) expect(r, `line "${r.text}"`).toMatchObject({ fits: true, oneLine: true });

  // 2) highlight switches on each word's first frame (checked on every word of the first 3 pages)
  const active = () =>
    page.evaluate(() => document.querySelector('[data-caption] [data-active]')?.textContent ?? null);
  let checked = 0;
  for (const pg of pages.slice(0, 3) as Page2[]) {
    for (const [wi, w] of pg.words.entries()) {
      const f = pg.startFrame + w.startFrame;
      await page.evaluate((frame) => window.__stage?.seek(frame), f);
      expect(await active(), `word ${wi} "${w.text}" at frame ${f}`).toBe(w.text);
      if (wi > 0 && (pg.words[wi - 1]?.endFrame ?? 0) >= w.startFrame) {
        await page.evaluate((frame) => window.__stage?.seek(frame), f - 1);
        expect(await active()).toBe(pg.words[wi - 1]?.text);
      }
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(10);
  console.log(`caption pages ${pages.length}, lines ${rows.length}, highlight checked on ${checked} words`);

  // 3) screenshots for review (first word of each of the first 4 pages)
  for (const [i, pg] of (pages.slice(0, 4) as Page2[]).entries()) {
    await page.evaluate(
      (frame) => window.__stage?.seek(frame),
      pg.startFrame + (pg.words[1]?.startFrame ?? 0),
    );
    await expect(page.locator('[data-stage]')).toHaveScreenshot(`captions-${i}.png`, {
      maxDiffPixelRatio: 0.002,
    });
  }
});
