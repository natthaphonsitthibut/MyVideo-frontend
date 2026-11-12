import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

/**
 * E12-F02: a library video can be deleted; projects made from it are listed in the confirm dialog and go with it.
 * State is created in this test (real upload → real ingest → a project referencing the new source id).
 */
const CLIP = fileURLToPath(
  new URL('../../../../../footage/clips/talkinghead-th-portrait.mp4', import.meta.url),
);
test.skip(!existsSync(CLIP), 'workspace footage not available');
test.describe.configure({ timeout: 240_000 });

test('delete a video that a project uses: dialog names the project, both are gone after confirming', async ({
  page,
}) => {
  await signIn(page, '/library');
  const handedOver = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await page.getByTestId('upload-input').setInputFiles(CLIP);
  const sourceId = ((await (await handedOver).json()) as { id: string }).id;

  // wait until probed (the project needs the real frame rate and length)
  let src: { status: string; fps: { num: number; den: number } | null; durationFrames: number | null } = {
    status: 'processing',
    fps: null,
    durationFrames: null,
  };
  await expect
    .poll(
      async () => {
        src = await (await page.request.get(`/api/sources/${sourceId}`)).json();
        return src.status;
      },
      { timeout: 180_000, intervals: [2000] },
    )
    .toBe('ready');
  const fps = src.fps ?? { num: 30, den: 1 };
  const len = Math.min(90, src.durationFrames ?? 90);
  const u = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const title = `ลบด้วยกัน ${sourceId.slice(-6)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      title,
      doc: {
        schemaVersion: 1,
        fps,
        width: 1080,
        height: 1920,
        durationFrames: len,
        assets: {
          [u(1)]: { sourceId, kind: 'video', durationFrames: src.durationFrames ?? len, hasAudio: true },
        },
        tracks: [{ id: u(10), kind: 'video', elementIds: [u(20)] }],
        elements: {
          [u(20)]: {
            type: 'video',
            id: u(20),
            trackId: u(10),
            startFrame: 0,
            durationFrames: len,
            origin: 'user',
            assetId: u(1),
            sourceInFrame: 0,
            playbackRate: 1,
            volume: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            fit: 'cover',
          },
        },
        meta: { createdBy: 'user', title },
      },
    },
  });
  expect(created.status()).toBe(201);
  const projectId = ((await created.json()) as { id: string }).id;

  await page.reload();
  const card = page
    .getByTestId('source-card')
    .filter({ has: page.locator(`a[href="/library/${sourceId}"]`) });
  await expect(card).toBeVisible();
  await card.getByTestId('delete-source').click();
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog.getByTestId('delete-source-projects')).toContainText(title);
  await page.screenshot({ path: 'test-results/library-delete-dialog.png', fullPage: true });
  await dialog.getByTestId('confirm-dialog-ok').click();

  await expect(dialog).toBeHidden();
  await expect(card).toHaveCount(0);
  expect((await page.request.get(`/api/sources/${sourceId}`)).status()).toBe(404);
  expect((await page.request.get(`/api/projects/${projectId}`)).status()).toBe(404);
  await expect(page).toHaveURL(/\/library$/);
  await page.screenshot({ path: 'test-results/library-after-delete.png', fullPage: true });
});
