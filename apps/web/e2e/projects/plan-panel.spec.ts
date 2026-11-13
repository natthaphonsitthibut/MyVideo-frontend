import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from '../auth';

// Real live-selling speech (C02, 55 s). The analysis uses the configured LLM mode (local agent in development).
const LIVE = fileURLToPath(
  new URL('../../../../../footage/clips/live-tiedye-th-vertical-b.mp4', import.meta.url),
);
test.skip(!existsSync(LIVE), 'workspace footage not available');
test.setTimeout(900_000);

test('plan panel: start → footage, transcription, analysis advance by themselves → pick a style → clips edited', async ({
  page,
}) => {
  await signIn(page, '/projects');
  await page.getByLabel('ชื่อโปรเจกต์').fill(`แผนงาน ${Date.now()}`);
  await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);

  const plan = page.getByRole('region', { name: 'แผนงาน' });
  await expect(plan.getByTestId('folder-start')).toBeDisabled(); // no footage yet
  const footage = page.getByRole('region', { name: 'ฟุตเทจต้นฉบับ', exact: true });
  await footage.getByTestId('upload-input').setInputFiles(LIVE);
  await expect(footage.getByTestId('source-card-link')).toHaveCount(1, { timeout: 120_000 });

  await expect(plan.getByTestId('folder-start')).toBeEnabled();
  await plan.getByTestId('folder-start').click();
  await expect(plan.getByTestId('plan-progress')).toBeVisible();
  const step = (id: string) => plan.getByTestId(`plan-step-${id}`);

  // mid-way: something is being worked on, shown as running with the "กำลังทำ" chip
  await expect(plan.getByText('กำลังทำ').first()).toBeVisible({ timeout: 180_000 });
  await page.screenshot({ path: 'test-results/plan-panel-midway.png', fullPage: true });

  await expect(step('prepare')).toHaveAttribute('data-state', 'done', { timeout: 180_000 });
  await expect(step('transcribe')).toHaveAttribute('data-state', 'done', { timeout: 300_000 });
  await expect(step('analyse')).toHaveAttribute('data-state', 'done', { timeout: 400_000 });
  await expect(step('style')).toHaveAttribute('data-state', 'waiting');
  await expect(plan.getByText('รอคุณเลือก').first()).toBeVisible();

  const pick = plan.getByTestId('folder-style-pick');
  const cards = await pick.getByRole('radio').count();
  expect(cards).toBeGreaterThan(0);
  expect(cards).toBeLessThanOrEqual(3);
  const chosenName = (await pick.locator('label').first().locator('span.font-medium').textContent()) ?? '';
  await page.screenshot({ path: 'test-results/plan-panel-style.png', fullPage: true });
  await pick.getByRole('button', { name: 'ตัดต่อด้วยสไตล์นี้' }).click();

  await expect(step('style')).toHaveAttribute('data-state', 'done');
  await expect(step('style')).toContainText(chosenName.replace('แนะนำ', '').trim()); // the Thai name, not an id
  await expect(step('edit')).toHaveAttribute('data-state', 'done', { timeout: 300_000 });
  await expect(plan.getByTestId('plan-progress')).toHaveText('เสร็จ 5/5');
  await expect(plan.getByTestId('folder-start')).toHaveText(/ตัดต่ออีกรอบ/);

  const clips = page.getByRole('region', { name: 'คลิปที่ตัดแล้ว', exact: true });
  await expect(clips.getByRole('list')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'test-results/plan-panel-done.png', fullPage: true });
});
