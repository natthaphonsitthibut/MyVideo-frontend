import { expect, test } from '@playwright/test';
import { signIn } from './auth';

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects$/);
  await page.getByLabel('อีเมล').fill('owner@demo.local');
  await page.getByLabel('รหัสผ่าน').fill('wrong-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page.getByRole('alert')).toHaveText('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  await page.screenshot({ path: 'test-results/login-error.png', fullPage: true });
});

test('navigation separates project folders, the Library and edited clips; removed pages redirect', async ({
  page,
}) => {
  await signIn(page, '/library');
  const nav = page.getByRole('navigation', { name: 'เมนูหลัก' });
  await expect(nav.getByRole('link')).toHaveText(['โปรเจกต์', 'คลังวิดีโอ', 'คลิปที่ตัดแล้ว', 'บันทึกเวลา']);
  await expect(page.getByTestId('merchant-name')).not.toBeEmpty();
  await page.screenshot({ path: 'test-results/shell-library.png', fullPage: true });
  for (const old of ['/review-video', '/exports', '/brand', '/jobs', '/status']) {
    await page.goto(old);
    await expect(page).toHaveURL(/\/projects$/);
  }
  await expect(page.getByRole('heading', { name: 'โปรเจกต์' })).toBeVisible();
  await page.screenshot({ path: 'test-results/shell-projects.png', fullPage: true });
});

test('dev diagnostics: service status shows a healthy API; log out', async ({ page }) => {
  await signIn(page, '/dev/status');
  await expect(page.getByTestId('overall-status')).toHaveText('ทุกอย่างปกติ');
  await expect(page.getByTestId('check-postgres')).toHaveAttribute('data-status', 'up');
  await expect(page.getByTestId('check-redis')).toHaveAttribute('data-status', 'up');
  await page.screenshot({ path: 'test-results/shell-status.png', fullPage: true });

  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/library');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('unknown routes show a friendly not-found page', async ({ page }) => {
  await signIn(page, '/library');
  await page.goto('/nope');
  await expect(page.getByRole('alert')).toContainText('ไม่พบหน้านี้');
});

test('phone width: menu is a drawer and the page has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await signIn(page, '/library');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/library-375.png', fullPage: true });
  await page.getByRole('button', { name: 'เปิดเมนู' }).click();
  await page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: 'โปรเจกต์' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('button', { name: 'เปิดเมนู' })).toBeVisible();
  await page.screenshot({ path: 'test-results/projects-375.png', fullPage: true });
});
