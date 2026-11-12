import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';

const footage = (p: string) => fileURLToPath(new URL(`../../../../../footage/${p}`, import.meta.url));
// real footage (MANIFEST): C05 GPU unboxing (silent, many shots), C04 multimeter review (hands + voice-over)
const CLIPS = [
  footage('clips/broll-gpu-unboxing-silent.mp4'),
  footage('clips/review-multimeter-th-hands.mp4'),
];

test.describe.configure({ timeout: 600_000 });

async function uploadReady(page: Page, file: string): Promise<void> {
  await signIn(page, '/library');
  const handedOver = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await page.getByTestId('upload-input').setInputFiles(file);
  const { id } = (await (await handedOver).json()) as { id: string };
  await expect
    .poll(
      async () =>
        ((await (await page.request.get(`/api/sources/${id}`)).json()) as { status: string }).status,
      { timeout: 240_000, intervals: [2000] },
    )
    .toBe('ready');
}

test('review video: missing talking head is explained; showcase opens in Quick Edit; template swap', async ({
  page,
}) => {
  for (const f of CLIPS) await uploadReady(page, f);
  await page.goto('/review-video');
  const boxes = page.getByTestId('review-source');
  await expect(boxes.first()).toBeVisible();
  // the two newest uploads
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByTestId('review-product-name').fill('มัลติมิเตอร์ดิจิทัล');
  await page.getByTestId('review-product-points').fill('วัดไฟได้แม่น\nจอใหญ่อ่านง่าย');

  // 1) review needs someone talking to the camera: the page says what to shoot, and lets the merchant fix roles
  await page.getByTestId('template-review').click();
  await page.getByTestId('review-start').click();
  await expect(page.getByTestId('review-missing')).toBeVisible({ timeout: 300_000 });
  await expect(page.getByTestId('review-missing-item').first()).toContainText('พูดหน้ากล้อง');
  await expect(page.getByTestId('review-shot-role').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/review-missing.png', fullPage: true });

  // 2) showcase works on product footage alone and opens the editable project
  await page.getByTestId('template-showcase').click();
  await page.getByTestId('review-start').click();
  await page.waitForURL(/\/clips\/[0-9a-f-]+\/edit$/, { timeout: 300_000 });
  await expect(page.getByTestId('quick-edit')).toBeVisible();
  await page.screenshot({ path: 'test-results/review-quick-edit.png', fullPage: true });

  // 3) the template tab offers the others; the current one is disabled
  await page.getByRole('tab', { name: 'เทมเพลต' }).click();
  await expect(page.getByTestId('swap-showcase')).toBeDisabled();
  await expect(page.getByTestId('swap-unboxing')).toBeEnabled();
});
