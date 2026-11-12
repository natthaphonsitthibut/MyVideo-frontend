import { expect, type Page, test } from '@playwright/test';
import { signIn } from './auth';

/** Clicks a test-run button and returns the locator of the run it created (by id from the API response). */
async function startTestRun(page: Page, button: string) {
  await page.getByRole('heading', { name: 'งานประมวลผล' }).waitFor();
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/workflow-runs/test') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: button }).click();
  const { id } = (await (await created).json()) as { id: string };
  const run = page.locator(`[data-testid=run-item][data-run-id="${id}"]`);
  await expect(run).toBeVisible({ timeout: 10_000 });
  return run;
}

test.describe.configure({ timeout: 60_000 });

// The jobs page is a developer diagnostic since D-037 (/dev/jobs, dev builds only).
test('start a test run, watch live progress, cancel it', async ({ page }) => {
  await signIn(page, '/dev/jobs');
  const run = await startTestRun(page, 'ทดสอบระบบคิว');
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
  await signIn(page, '/dev/jobs');
  const run = await startTestRun(page, 'ทดสอบกรณีล้มเหลว');
  await expect(run.getByTestId('job-row')).toHaveAttribute('data-status', 'dead', { timeout: 15_000 });
  await expect(run.getByTestId('job-error')).toContainText('simulated failure');
  await page.screenshot({ path: 'test-results/jobs-dead.png', fullPage: true });
  await run.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(run.getByTestId('job-row')).toHaveAttribute('data-status', 'succeeded', { timeout: 30_000 });
  await expect(run).toHaveAttribute('data-status', 'succeeded');
  await page.screenshot({ path: 'test-results/jobs-retried.png', fullPage: true });
});
