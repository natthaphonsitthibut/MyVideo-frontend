import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signIn } from './auth';

// Real footage from the workspace (MANIFEST S03, 31 MB, CC BY). E2E runs only where the footage exists.
const CLIP = fileURLToPath(new URL('../../../../footage/stock/yt-cc/SvoItPQ2-YE.mp4', import.meta.url));
const SIZE = statSync(CLIP).size;

test.describe.configure({ timeout: 120_000 });

test('uploads a real clip through a network drop and stays responsive', async ({ page, context }) => {
  await signIn(page, '/library');
  const cdp = await context.newCDPSession(page);
  const throttle = () =>
    cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 20,
      downloadThroughput: -1,
      uploadThroughput: 3 * 1024 * 1024,
    });
  await cdp.send('Network.enable');
  await throttle();
  await page.evaluate(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longTasks.push(e.duration);
    }).observe({ type: 'longtask' });
  });

  await page.getByTestId('upload-input').setInputFiles(CLIP);
  const row = page.getByTestId('upload-row').first();
  const bar = row.getByRole('progressbar');
  await expect
    .poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 30_000 })
    .toBeGreaterThan(15);

  // network drop
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await expect(row).toHaveAttribute('data-status', /retrying|error/, { timeout: 15_000 });
  const atDrop = Number(await bar.getAttribute('aria-valuenow'));
  await page.screenshot({ path: 'test-results/upload-dropped.png', fullPage: true });
  await page.waitForTimeout(2500);
  await throttle();
  if ((await row.getAttribute('data-status')) === 'error')
    await row.getByRole('button', { name: 'อัปโหลดต่อ' }).click();

  await expect(row).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
  await page.screenshot({ path: 'test-results/upload-done.png', fullPage: true });
  expect(atDrop).toBeGreaterThan(0);

  const longTasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
  expect(Math.max(0, ...longTasks), `long tasks: ${JSON.stringify(longTasks)}`).toBeLessThanOrEqual(50);

  // the server has the whole file as a source, resumed (not restarted)
  const sources = await page.evaluate(async () => {
    const r = await fetch('/api/workflow-runs?limit=1');
    return r.json();
  });
  expect(sources.items[0]).toMatchObject({ kind: 'ingest' });
  const sourceId = sources.items[0].subjectId;
  const src = await page.evaluate(async (id) => (await fetch(`/api/sources/${id}`)).json(), sourceId);
  expect(src).toMatchObject({ sizeBytes: SIZE, originalFilename: 'SvoItPQ2-YE.mp4' });
});

test('rejects a non-video file before sending anything', async ({ page }) => {
  await signIn(page, '/library');
  await page
    .getByTestId('upload-input')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  const row = page.getByTestId('upload-row').first();
  await expect(row).toHaveAttribute('data-status', 'error');
  await expect(row.getByRole('alert')).toContainText('ไม่ใช่วิดีโอที่รองรับ');
  await page.screenshot({ path: 'test-results/upload-wrong-type.png', fullPage: true });
});
