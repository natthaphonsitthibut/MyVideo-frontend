import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

const F = (p: string) => fileURLToPath(new URL(`../../../../../footage/${p}`, import.meta.url));
const VIDEOS = [
  F('clips/talkinghead-th-portrait.mp4'),
  F('clips/review-multimeter-th-hands.mp4'),
  F('clips/broll-gpu-unboxing-silent.mp4'),
];
const PHOTOS = [F('photos/P01-yarn-product.jpg'), F('photos/P03-yarn-hands.webp')];
test.skip(![...VIDEOS, ...PHOTOS].every(existsSync), 'workspace footage not available');
test.setTimeout(300_000);

test('new project: drop 3 videos + 2 photos, pick 16:9 and type the product → saved with 5 assets', async ({
  page,
}) => {
  await signIn(page, '/projects');
  const title = `ชุดทดสอบใหม่ ${Date.now()}`;
  await page.getByLabel('ชื่อโปรเจกต์').fill(title);
  await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
  const folderId = page.url().split('/').pop() ?? '';

  const settings = page.getByRole('region', { name: 'ตั้งค่าการตัดต่อ' });
  await expect(settings.getByRole('radio', { name: 'อัตโนมัติ' }).first()).toBeChecked();
  await expect(settings.getByText('ยังไม่มีฟุตเทจ → 9:16')).toBeVisible();

  // one multi-file pick: real videos and real photos together
  const footage = page.getByRole('region', { name: 'ฟุตเทจต้นฉบับ', exact: true });
  const handovers: Promise<unknown>[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/sources/by-upload/') && r.status() === 200) handovers.push(r.json());
  });
  await footage.getByTestId('upload-input').setInputFiles([...VIDEOS, ...PHOTOS]);
  await expect.poll(() => handovers.length, { timeout: 120_000 }).toBe(5);
  await expect(footage.getByTestId('source-card-link')).toHaveCount(5, { timeout: 60_000 });

  // the two photos become still footage (shown as "รูป", not as a 0:05 video)
  await expect
    .poll(
      async () => {
        const f = await (await page.request.get(`/api/folders/${folderId}`)).json();
        const kinds = await Promise.all(
          (f.sourceIds as string[]).map(
            async (id) => (await (await page.request.get(`/api/sources/${id}`)).json()).kind,
          ),
        );
        return kinds.sort().join(',');
      },
      { timeout: 180_000, intervals: [1000] },
    )
    .toBe('photo,photo,video,video,video');
  await expect(footage.getByText('รูป', { exact: true })).toHaveCount(2);
  // 3 of 5 items are landscape (multimeter, GPU, both yarn photos) → auto resolves to 16:9
  await expect(settings.getByText(/ตามฟุตเทจส่วนใหญ่ → 16:9/)).toBeVisible();

  // click the visible option (the radio itself is visually hidden), then wait for it to show as chosen
  for (const [group, option] of [
    ['สัดส่วนภาพ', '16:9'],
    ['ทำวิดีโอแบบไหน', 'รีวิวสินค้า'],
    ['ความยาว', '30 วิ'],
  ] as const) {
    const radios = settings.getByRole('radiogroup', { name: group });
    await radios.getByText(option, { exact: true }).click();
    await expect(radios.getByRole('radio', { name: option })).toBeChecked();
  }
  await settings.getByLabel('ชื่อสินค้า').fill('ไหมพรม 5 สี');
  await settings.getByLabel('ราคา').fill('159 บาท');
  await settings.getByLabel('ชื่อสินค้า').focus(); // blur the price field → save
  await expect(settings.getByRole('status')).toHaveText('บันทึกแล้ว');

  await page.reload();
  const saved = await (await page.request.get(`/api/folders/${folderId}`)).json();
  expect(saved.sourceIds).toHaveLength(5);
  expect(saved.settings).toEqual({
    ratio: '16:9',
    goal: 'review',
    length: '30',
    productName: 'ไหมพรม 5 สี',
    productPrice: '159 บาท',
  });
  await expect(settings.getByRole('radio', { name: '16:9' })).toBeChecked();
  await expect(settings.getByLabel('ราคา')).toHaveValue('159 บาท');
  await page.screenshot({ path: 'test-results/new-project-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(settings).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'test-results/new-project-mobile.png', fullPage: true });
});
