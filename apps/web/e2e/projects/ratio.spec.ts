import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';

/**
 * E12-F09: the project's ratio drives the edit. Real footage both ways, rendered by the real renderer:
 * a phone-vertical live clip (C02, 406×720) edited for 16:9 and horizontal footage with a person (C07, 1920×1080)
 * edited for 9:16. Each MP4 is probed and turned into a frame sheet for review.
 */
const F = (p: string) => fileURLToPath(new URL(`../../../../../footage/${p}`, import.meta.url));
const VERTICAL = F('clips/live-tiedye-th-vertical-b.mp4');
const HORIZONTAL = F('clips/broll-yarn-unboxing-hands.mp4');
const OUT = 'test-results/ratio';
test.skip(![VERTICAL, HORIZONTAL].every(existsSync), 'workspace footage not available');
test.setTimeout(1_200_000);

async function editFolder(page: Page, file: string, ratio: string, title: string) {
  await page.goto('/projects');
  await page.getByLabel('ชื่อโปรเจกต์').fill(title);
  await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
  const folderId = page.url().split('/').pop() ?? '';
  const settings = page.getByRole('region', { name: 'ตั้งค่าการตัดต่อ' });
  const radios = settings.getByRole('radiogroup', { name: 'สัดส่วนภาพ' });
  await radios.getByText(ratio, { exact: true }).click();
  await expect(radios.getByRole('radio', { name: ratio })).toBeChecked();
  await expect(settings.getByRole('status')).toHaveText('บันทึกแล้ว');
  const footage = page.getByRole('region', { name: 'ฟุตเทจต้นฉบับ', exact: true });
  await footage.getByTestId('upload-input').setInputFiles(file);
  await expect(footage.getByTestId('source-card-link')).toHaveCount(1, { timeout: 120_000 });
  const plan = page.getByRole('region', { name: 'แผนงาน' });
  await expect(plan.getByTestId('folder-start')).toBeEnabled();
  await plan.getByTestId('folder-start').click();
  const pick = plan.getByTestId('folder-style-pick');
  await expect(pick).toBeVisible({ timeout: 600_000 });
  await pick.getByRole('button', { name: 'ตัดต่อด้วยสไตล์นี้' }).click();
  await expect(plan.getByTestId('plan-step-edit')).toHaveAttribute('data-state', 'done', {
    timeout: 300_000,
  });
  const folder = (await (await page.request.get(`/api/folders/${folderId}`)).json()) as { clipIds: string[] };
  expect(folder.clipIds.length).toBeGreaterThan(0);
  return folder.clipIds[0] as string;
}

async function renderSheet(page: Page, projectId: string, name: string) {
  const req = await page.request.post(`/api/projects/${projectId}/renders`, { data: { preset: 'standard' } });
  const renderId = ((await req.json()) as { id: string }).id;
  await expect
    .poll(
      async () =>
        ((await (await page.request.get(`/api/renders/${renderId}`)).json()) as { status: string }).status,
      { timeout: 600_000, intervals: [3000] },
    )
    .toBe('ready');
  mkdirSync(OUT, { recursive: true });
  const mp4 = `${OUT}/${name}.mp4`;
  writeFileSync(mp4, await (await page.request.get(`/api/renders/${renderId}/file`)).body());
  const [w, h] = execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    mp4,
  ])
    .toString()
    .trim()
    .split(',')
    .map(Number);
  // 8 frames spread over the clip, tiled 4×2
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    mp4,
    '-vf',
    "select='not(mod(n\\,90))',scale=480:-2,tile=4x2",
    '-frames:v',
    '1',
    `${OUT}/${name}-sheet.jpg`,
  ]);
  return { width: w, height: h };
}

test('ratio drives the edit: vertical live → 16:9 shown whole on a backdrop; horizontal → 9:16 filled', async ({
  page,
}) => {
  await signIn(page, '/projects');

  const wideId = await editFolder(page, VERTICAL, '16:9', `แนวนอน ${Date.now()}`);
  const wide = (await (await page.request.get(`/api/projects/${wideId}`)).json()) as {
    doc: {
      width: number;
      height: number;
      elements: Record<string, { type: string; fit?: string; width?: number }>;
    };
  };
  expect(wide.doc).toMatchObject({ width: 1920, height: 1080 });
  const wideEls = Object.values(wide.doc.elements);
  expect(wideEls.filter((e) => e.type === 'video').every((e) => e.fit === 'contain')).toBe(true);
  expect(wideEls.some((e) => e.type === 'shape' && e.width === 1920)).toBe(true);
  expect(await renderSheet(page, wideId, 'vertical-to-16x9')).toEqual({ width: 1920, height: 1080 });

  const tallId = await editFolder(page, HORIZONTAL, '9:16', `แนวตั้ง ${Date.now()}`);
  const tall = (await (await page.request.get(`/api/projects/${tallId}`)).json()) as {
    doc: { width: number; height: number; elements: Record<string, { type: string; fit?: string }> };
  };
  expect(tall.doc).toMatchObject({ width: 1080, height: 1920 });
  expect(
    Object.values(tall.doc.elements)
      .filter((e) => e.type === 'video')
      .every((e) => e.fit === 'cover'),
  ).toBe(true);
  expect(await renderSheet(page, tallId, 'horizontal-to-9x16')).toEqual({ width: 1080, height: 1920 });
});
