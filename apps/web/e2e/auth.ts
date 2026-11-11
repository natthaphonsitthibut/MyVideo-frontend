import { expect, type Page } from '@playwright/test';

/** Dev seed user (`pnpm db:seed` in backend). */
export const DEV_USER = {
  email: process.env.MYVIDEO_E2E_EMAIL ?? 'owner@demo.local',
  password: process.env.MYVIDEO_E2E_PASSWORD ?? 'myvideo-dev-password',
};

export async function signIn(page: Page, next = '/library'): Promise<void> {
  await page.goto(next);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('อีเมล').fill(DEV_USER.email);
  await page.getByLabel('รหัสผ่าน').fill(DEV_USER.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}
