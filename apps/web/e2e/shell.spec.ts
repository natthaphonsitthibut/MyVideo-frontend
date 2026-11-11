import { expect, test } from '@playwright/test';

test('app shell opens and the status page sees a healthy API', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/library$/);
  const nav = page.getByRole('navigation', { name: 'เมนูหลัก' });
  for (const label of ['คลังวิดีโอ', 'คลิป', 'ไฟล์ส่งออก']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/shell-library.png', fullPage: true });

  await page.getByRole('link', { name: 'สถานะระบบ' }).click();
  await expect(page.getByTestId('overall-status')).toHaveText('ทุกอย่างปกติ');
  await expect(page.getByTestId('check-postgres')).toHaveAttribute('data-status', 'up');
  await expect(page.getByTestId('check-redis')).toHaveAttribute('data-status', 'up');
  await page.screenshot({ path: 'test-results/shell-status.png', fullPage: true });
});

test('unknown routes show a friendly not-found page', async ({ page }) => {
  await page.goto('/nope');
  await expect(page.getByRole('alert')).toContainText('ไม่พบหน้านี้');
});
