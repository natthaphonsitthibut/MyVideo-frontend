import { expect, test } from '@playwright/test';
import { signIn } from './auth';

test.describe.configure({ timeout: 60_000 });

test('start a test run, watch live progress, cancel it', async ({ page }) => {
  await signIn(page, '/jobs');
  await page.getByRole('button', { name: 'ทดสอบระบบคิว' }).click();
  const run = page.getByTestId('run-item').first();
  const bar = run.getByRole('progressbar');
  await expect(run.getByTestId('job-row')).toHaveAttribute('data-status', 'running', { timeout: 15_000 });
  await expect
    .poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 15_000 })
    .toBeGreaterThan(0);
  const first = Number(await bar.getAttribute('aria-valuenow'));
  await expect
    .poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 15_000 })
    .toBeGreaterThan(first);
  await page.screenshot({ path: 'test-results/jobs-running.png', fullPage: true });
  await run.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(run.getByTestId('job-row')).toHaveAttribute('data-status', 'cancelled', { timeout: 15_000 });
  await expect(run).toHaveAttribute('data-status', 'cancelled');
});

test('a failing run shows the error, and retry makes it succeed', async ({ page }) => {
  await signIn(page, '/jobs');
  await page.getByRole('button', { name: 'ทดสอบกรณีล้มเหลว' }).click();
  const run = page.getByTestId('run-item').first();
  await expect(run.getByTestId('job-row')).toHaveAttribute('data-status', 'dead', { timeout: 15_000 });
  await expect(run.getByTestId('job-error')).toContainText('simulated failure');
  await page.screenshot({ path: 'test-results/jobs-dead.png', fullPage: true });
  await run.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(run.getByTestId('job-row')).toHaveAttribute('data-status', 'succeeded', { timeout: 30_000 });
  await expect(run).toHaveAttribute('data-status', 'succeeded');
  await page.screenshot({ path: 'test-results/jobs-retried.png', fullPage: true });
});
