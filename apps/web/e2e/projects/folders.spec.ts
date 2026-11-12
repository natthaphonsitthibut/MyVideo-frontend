import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

const CLIP = fileURLToPath(
  new URL('../../../../../footage/clips/talkinghead-th-portrait.mp4', import.meta.url),
);
test.skip(!existsSync(CLIP), 'workspace footage not available');
test.setTimeout(240_000);

test('project folder: upload footage, add from Library, keep edited clips in a separate section', async ({
  page,
}) => {
  await signIn(page, '/projects');
  const title = `ทดสอบโฟลเดอร์ ${Date.now()}`;
  await expect(page.getByLabel('ชื่อโปรเจกต์')).toBeVisible();
  await page.getByLabel('ชื่อโปรเจกต์').fill(title);
  await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const footage = page.getByRole('region', { name: 'ฟุตเทจต้นฉบับ', exact: true });
  const clips = page.getByRole('region', { name: 'คลิปที่ตัดแล้ว', exact: true });
  const handover = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await footage.getByTestId('upload-input').setInputFiles(CLIP);
  const sourceId = ((await (await handover).json()) as { id: string }).id;
  await expect(
    footage.locator(`[data-testid="source-card-link"][href="/library/${sourceId}"]`),
  ).toBeVisible();
  // A manually cut, editable timeline from this real upload appears only in the edited section.
  // This checks folder membership; it does not claim to evaluate AI edit quality.
  let src: {
    status: string;
    durationFrames: number | null;
    fps: { num: number; den: number } | null;
    hasAudio: boolean | null;
  };
  await expect
    .poll(
      async () => {
        src = await (await page.request.get(`/api/sources/${sourceId}`)).json();
        return src.status;
      },
      { timeout: 180_000, intervals: [1000] },
    )
    .toBe('ready');
  const u = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const edited = await page.request.post('/api/projects', {
    data: {
      title: 'คลิปจากวิดีโอจริง',
      doc: {
        schemaVersion: 1,
        fps: src!.fps,
        width: 1080,
        height: 1920,
        durationFrames: 60,
        assets: {
          [u(1)]: { sourceId, kind: 'video', durationFrames: src!.durationFrames, hasAudio: src!.hasAudio },
        },
        tracks: [{ id: u(2), kind: 'video', elementIds: [u(3)] }],
        elements: {
          [u(3)]: {
            type: 'video',
            id: u(3),
            trackId: u(2),
            startFrame: 0,
            durationFrames: 60,
            origin: 'user',
            assetId: u(1),
            sourceInFrame: 0,
            playbackRate: 1,
            volume: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            fit: 'cover',
          },
        },
        meta: { createdBy: 'user', title: 'คลิปจากวิดีโอจริง' },
      },
    },
  });
  expect(edited.status()).toBe(201);
  const editedId = ((await edited.json()) as { id: string }).id;
  await expect(clips.getByTestId('edited-clip')).toHaveCount(1, { timeout: 10_000 });
  await expect(footage.getByTestId('edited-clip')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/project-folder-with-clip.png', fullPage: true });
  const folderUrl = page.url();
  await page.goto('/clips');
  await expect(page.getByRole('heading', { name: 'คลิปที่ตัดแล้ว', exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/clips/${editedId}"]`)).toBeVisible();
  await page.screenshot({ path: 'test-results/edited-clips-page.png', fullPage: true });
  await page.goto(folderUrl);
  await clips.getByTestId('edited-clip').click();
  await expect(page).toHaveURL(new RegExp(`/clips/${editedId}$`));
  await page.goBack();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect
    .poll(async () => {
      const box = await page.locator('#app-sidebar').boundingBox();
      return box ? box.x + box.width : 0;
    })
    .toBeLessThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(clips.getByTestId('edited-clip')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/project-folder-mobile.png', fullPage: true });
  await expect(clips.getByTestId('source-card')).toHaveCount(0);
  await page.reload();
  await expect(
    footage.locator(`[data-testid="source-card-link"][href="/library/${sourceId}"]`),
  ).toBeVisible();
  await page.goto('/library');
  await expect(page.locator(`[data-testid="source-card-link"][href="/library/${sourceId}"]`)).toBeVisible();
  // A second folder reuses the same source ID from the Library, without another upload.
  await page.goto('/projects');
  await page.getByLabel('ชื่อโปรเจกต์').fill(`${title} อีกโฟลเดอร์`);
  await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มจากคลังวิดีโอ', exact: true }).click();
  await page.locator(`input[data-source-id="${sourceId}"]`).check();
  await page.getByRole('button', { name: 'เพิ่มวิดีโอที่เลือก', exact: true }).click();
  await expect(
    footage.locator(`[data-testid="source-card-link"][href="/library/${sourceId}"]`),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/project-folder.png', fullPage: true });
});
