import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01_TITLE } from '../footage';

/**
 * Visual regression of the stage on a REAL project (footage S01 + its real transcript words as overlay text).
 * Baselines are frames of footage, so they live in the workspace `footage/baselines/` (never committed); the test
 * is skipped where the footage is not available (CI).
 */
const FOOTAGE = fileURLToPath(new URL('../../../../../footage', import.meta.url));
test.skip(!existsSync(`${FOOTAGE}/MANIFEST.md`), 'workspace footage not available');
test.describe.configure({ timeout: 240_000 });
test.use({ viewport: { width: 1200, height: 2000 } });

const FPS = 30;
const SRC_START_MS = 720_000; // S01 12:00 — the excerpt used by the backend fixture
const LEN = 710;

async function createProject(page: Page): Promise<string> {
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string; durationMs: number | null }[];
  };
  const s01 = readySource(list.items, S01_TITLE);
  test.skip(!s01, 'S01 is not ingested in this dev database');
  if (!s01) return '';
  const seg = (await (
    await page.request.get(`/api/sources/${s01.id}/transcript/segments?from=0&limit=1000`)
  ).json()) as { items: { startMs: number; text: string }[] };
  // real words spoken in this excerpt, shown as a text overlay
  const said = seg.items.find((x) => x.startMs >= SRC_START_MS + 2000)?.text ?? 'S01';
  const u = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const tf = (y: number) => ({ x: 0, y, scale: 1, rotation: 0 });
  const doc = {
    schemaVersion: 1,
    fps: { num: FPS, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: LEN,
    assets: { [u(1)]: { sourceId: s01.id, kind: 'video', durationFrames: 81_000, hasAudio: true } },
    tracks: [
      { id: u(10), kind: 'video', elementIds: [u(20), u(21)] },
      { id: u(11), kind: 'overlay', elementIds: [u(30), u(31)] },
    ],
    elements: {
      [u(20)]: {
        type: 'video',
        id: u(20),
        trackId: u(10),
        startFrame: 0,
        durationFrames: 400,
        origin: 'ai',
        assetId: u(1),
        sourceInFrame: (SRC_START_MS / 1000) * FPS,
        playbackRate: 1,
        volume: 1,
        transform: tf(0),
        fit: 'cover',
      },
      [u(21)]: {
        type: 'video',
        id: u(21),
        trackId: u(10),
        startFrame: 400,
        durationFrames: 310,
        origin: 'ai',
        assetId: u(1),
        sourceInFrame: (SRC_START_MS / 1000) * FPS + 600,
        playbackRate: 1,
        volume: 1,
        transform: { x: 0, y: 0, scale: 1.4, rotation: 0 },
        fit: 'cover',
      },
      [u(30)]: {
        type: 'text',
        id: u(30),
        trackId: u(11),
        startFrame: 30,
        durationFrames: 300,
        origin: 'ai',
        content: said,
        styleRef: 'title',
        transform: tf(-640),
        animationIn: { presetId: 'pop', durationFrames: 12 },
        animationOut: { presetId: 'fade', durationFrames: 9 },
      },
      [u(31)]: {
        type: 'shape',
        id: u(31),
        trackId: u(11),
        startFrame: 400,
        durationFrames: 300,
        origin: 'user',
        shape: 'rect',
        width: 600,
        height: 12,
        fill: '#facc15',
        radius: 6,
        transform: tf(700),
        keyframes: {
          'transform.x': [
            { frame: 0, value: -500, easing: 'ease-out' },
            { frame: 30, value: 0, easing: 'linear' },
          ],
        },
      },
    },
    meta: { createdBy: 'user', title: 'stage visual test' },
  };
  const res = await page.request.post('/api/projects', { data: { title: 'stage visual test', doc } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** 20 frames spread over the project, incl. element edges and animation middles. */
const FRAMES = [0, 29, 30, 36, 41, 100, 250, 320, 329, 330, 399, 400, 415, 430, 500, 600, 650, 699, 700, 709];

test('seeking back to the first frame reproduces the first decoded picture', async ({ page }) => {
  await signIn(page, '/library');
  const id = await createProject(page);
  await page.goto(`/dev/stage/${id}`);
  await page.waitForFunction(() => !!window.__stage);
  await page.evaluate(() => window.__stage?.ready());
  const stage = page.locator('[data-stage]');
  const shot = async (frame: number) => {
    await page.evaluate((f) => window.__stage?.seek(f), frame);
    return stage.screenshot({ animations: 'allow' });
  };
  const first = await shot(0);
  await shot(500);
  await shot(399);
  const again = await shot(0);
  expect(again.equals(first)).toBe(true);
});

test('stage draws 20 frames of a real project identically to the baseline, whatever the seek order', async ({
  page,
}) => {
  await signIn(page, '/library');
  const id = await createProject(page);
  await page.goto(`/dev/stage/${id}`);
  await page.waitForFunction(() => !!window.__stage);
  await page.evaluate(() => window.__stage?.ready());
  const stage = page.locator('[data-stage]');

  const shot = async (f: number) => {
    await page.evaluate((frame) => window.__stage?.seek(frame), f);
    await expect(stage).toHaveScreenshot(`frame-${String(f).padStart(3, '0')}.png`, {
      maxDiffPixelRatio: 0.002,
      animations: 'allow',
    });
  };
  for (const f of FRAMES) await shot(f);
  // same frames in a scrambled order must give the same pictures (no wall-clock / history dependence)
  const shuffled = [...FRAMES].sort((a, b) => ((a * 7919) % 101) - ((b * 7919) % 101));
  for (const f of shuffled) await shot(f);
});
