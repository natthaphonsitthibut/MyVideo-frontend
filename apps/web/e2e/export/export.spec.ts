import { randomUUID } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01_TITLE } from '../footage';

/**
 * E06-F04 acceptance on REAL footage: a 6 s clip of the live S01 → clip page → "ส่งออก MP4" → live progress →
 * download → the file has the rendered size, and the same render plays in a <video> with the right duration.
 * Needs the full dev stack incl. the worker (Chromium renders), started outside the sandbox.
 */
const FOOTAGE = fileURLToPath(new URL('../../../../../footage', import.meta.url));
test.skip(!existsSync(`${FOOTAGE}/MANIFEST.md`), 'workspace footage not available');
test.describe.configure({ timeout: 300_000 });

test('open clip → Export → progress → download → plays with the right duration', async ({ page }) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: {
      id: string;
      title: string;
      status: string;
      fps: { num: number; den: number } | null;
      durationFrames: number | null;
    }[];
  };
  const s01 = readySource(list.items, S01_TITLE);
  test.skip(!s01?.fps, 'S01 is not ingested in this dev database');
  if (!s01?.fps || !s01.durationFrames) return;

  // a fresh 6 s project (180 frames at 30 fps) on S01 at 12:00, with a title overlay
  const frames = Math.round((6 * s01.fps.num) / s01.fps.den);
  const [asset, vTrack, oTrack, video, text] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const doc = {
    schemaVersion: 1,
    fps: s01.fps,
    width: 1080,
    height: 1920,
    durationFrames: frames,
    assets: {
      [asset]: { sourceId: s01.id, kind: 'video', durationFrames: s01.durationFrames, hasAudio: true },
    },
    tracks: [
      { id: vTrack, kind: 'video', elementIds: [video] },
      { id: oTrack, kind: 'overlay', elementIds: [text] },
    ],
    elements: {
      [video]: {
        type: 'video',
        id: video,
        trackId: vTrack,
        startFrame: 0,
        durationFrames: frames,
        origin: 'user',
        assetId: asset,
        sourceInFrame: Math.round((720 * s01.fps.num) / s01.fps.den),
        playbackRate: 1,
        volume: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        fit: 'cover',
      },
      [text]: {
        type: 'text',
        id: text,
        trackId: oTrack,
        startFrame: 0,
        durationFrames: frames,
        origin: 'user',
        content: `ส่งออกทดสอบ ${Date.now() % 100000}`, // unique → a new version, never a cached render
        styleRef: 'title',
        transform: { x: 0, y: -600, scale: 1, rotation: 0 },
      },
    },
    meta: { createdBy: 'user', title: 'export e2e' },
  };
  const created = await page.request.post('/api/projects', { data: { title: 'ทดสอบส่งออก', doc } });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };

  await page.goto(`/clips/${project.id}`);
  await expect(page.getByTestId('clip-title')).toHaveText('ทดสอบส่งออก');
  await page.getByTestId('export-button').click();

  const row = page.getByTestId('render-row').first();
  await expect(row).toHaveAttribute('data-status', /queued|rendering/);
  // live progress over SSE: the bar moves while rendering
  await expect(row).toHaveAttribute('data-status', 'rendering', { timeout: 120_000 });
  await expect
    .poll(async () => Number(await row.getByRole('progressbar').getAttribute('aria-valuenow')), {
      timeout: 120_000,
    })
    .toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/export-progress.png' });
  await expect(row).toHaveAttribute('data-status', 'ready', { timeout: 240_000 });
  await page.screenshot({ path: 'test-results/export-ready.png' });
  const renderId = (await row.getAttribute('data-render-id')) ?? '';
  const render = (await (await page.request.get(`/api/renders/${renderId}`)).json()) as {
    sizeBytes: number;
    durationMs: number;
  };

  // download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    row.getByTestId('render-download').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^myvideo-.*-v1-standard\.mp4$/);
  const path = await download.path();
  expect(statSync(path).size).toBe(render.sizeBytes);

  // the same file plays in a <video>, with the project's duration
  const played = await page.evaluate(async (src) => {
    const v = document.createElement('video');
    v.muted = true;
    v.src = src;
    document.body.appendChild(v);
    await new Promise<void>((res, rej) => {
      v.addEventListener('loadedmetadata', () => res(), { once: true });
      v.addEventListener('error', () => rej(new Error(`video error ${v.error?.code}`)), { once: true });
    });
    await v.play();
    await new Promise((r) => setTimeout(r, 800));
    v.pause();
    const out = { duration: v.duration, currentTime: v.currentTime, w: v.videoWidth, h: v.videoHeight };
    v.remove();
    return out;
  }, `/api/renders/${renderId}/file`);
  console.log(`render ${renderId}: ${JSON.stringify({ ...render, played })}`);
  expect(played.w).toBe(1080);
  expect(played.h).toBe(1920);
  expect(Math.abs(played.duration - 6)).toBeLessThan(0.1);
  expect(played.currentTime).toBeGreaterThan(0.3); // it really played

  // the Exports page lists it with a download
  await page.goto('/exports');
  await expect(page.locator(`[data-render-id="${renderId}"]`)).toHaveAttribute('data-status', 'ready');
  await page.screenshot({ path: 'test-results/exports-page.png' });
});
