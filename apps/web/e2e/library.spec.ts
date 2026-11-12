import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from './auth';

const footage = (p: string) => fileURLToPath(new URL(`../../../../footage/${p}`, import.meta.url));
const REVIEW = footage('clips/review-multimeter-th-hands.mp4'); // real, 55 s, MANIFEST C04
const TRUNCATED = footage('clips/invalid/truncated-talking-head.mp4'); // MANIFEST C10

test.describe.configure({ timeout: 180_000 });

async function upload(page: Page, file: string): Promise<string> {
  const handedOver = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await page.getByTestId('upload-input').setInputFiles(file);
  return ((await (await handedOver).json()) as { id: string }).id;
}

test('upload → ingest steps complete live → play and scrub the proxy smoothly', async ({ page }) => {
  await signIn(page, '/library');
  const id = await upload(page, REVIEW);
  const card = page.locator(`a[href="/library/${id}"]`);
  await expect(card).toBeVisible();
  await card.click();
  // live steps on the source page
  const steps = page.getByTestId('ingest-step');
  await expect(steps).toHaveCount(4);
  await page.screenshot({ path: 'test-results/source-processing.png', fullPage: true });
  await expect(page.getByTestId('proxy-video')).toBeVisible({ timeout: 120_000 });
  await expect(steps).toHaveCount(0, { timeout: 120_000 }); // panel disappears once the source is ready
  await page.screenshot({ path: 'test-results/source-ready.png', fullPage: true });

  // play a little
  const video = page.getByTestId('proxy-video');
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 })
    .toBeGreaterThan(1);
  await video.evaluate((v: HTMLVideoElement) => v.pause());

  // scrub for ~3 s while recording frame deltas and long tasks
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; long: number[]; on: boolean } };
    w.__perf = { deltas: [], long: [], on: true };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration);
    }).observe({ type: 'longtask' });
    let last = performance.now();
    const loop = (t: number) => {
      w.__perf.deltas.push(t - last);
      last = t;
      if (w.__perf.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const track = page.getByTestId('scrub-track');
  const box = await track.boundingBox();
  if (!box) throw new Error('no track');
  const y = box.y + 20;
  await page.mouse.move(box.x + 5, y);
  await page.mouse.down();
  for (let i = 0; i <= 90; i++) {
    await page.mouse.move(box.x + 5 + (((box.width - 10) * i) / 90) * 0.75, y);
    await page.waitForTimeout(30);
  }
  await page.screenshot({ path: 'test-results/source-scrubbing.png', fullPage: true });
  const releasedAt = Date.now();
  await page.mouse.up();
  const target = await video.evaluate((v: HTMLVideoElement) => v.duration * 0.75);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 2000, intervals: [10] })
    .toBeGreaterThan(target - 1);
  const settleMs = Date.now() - releasedAt;
  const perf = await page.evaluate(() => {
    const w = window as unknown as { __perf: { deltas: number[]; long: number[]; on: boolean } };
    w.__perf.on = false;
    const d = [...w.__perf.deltas].slice(5).sort((a, b) => a - b);
    return {
      frames: d.length,
      p95: d[Math.floor(d.length * 0.95)] ?? 0,
      maxLong: Math.max(0, ...w.__perf.long),
    };
  });
  console.log(`scrub perf ${JSON.stringify(perf)} settleMs=${settleMs}`);
  expect(perf.p95).toBeLessThanOrEqual(20);
  expect(perf.maxLong).toBeLessThanOrEqual(50);
  expect(settleMs).toBeLessThanOrEqual(1000); // includes Playwright polling overhead; the frame budget is above
});

test('a broken upload ends in a visible failed state with the reason', async ({ page }) => {
  await signIn(page, '/library');
  const id = await upload(page, TRUNCATED);
  const card = page.locator(`a[href="/library/${id}"]`);
  await expect(card).toHaveAttribute('data-status', 'failed', { timeout: 60_000 });
  await expect(card).toContainText('ไฟล์วิดีโอไม่ครบ');
  await page.screenshot({ path: 'test-results/library-failed-card.png', fullPage: true });
  await card.click();
  await expect(page.getByRole('alert')).toContainText('ไฟล์วิดีโอไม่ครบ');
  await page.screenshot({ path: 'test-results/source-failed.png', fullPage: true });
});

test('empty and loading states', async ({ page }) => {
  await signIn(page, '/clips');
  await page.route('**/api/sources?*', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.goto('/library');
  await expect(page.getByRole('status', { name: 'กำลังโหลด' })).toBeVisible();
  await page.screenshot({ path: 'test-results/library-loading.png', fullPage: true });
  await expect(page.getByText('ยังไม่มีวิดีโอ')).toBeVisible();
  await page.screenshot({ path: 'test-results/library-empty.png', fullPage: true });
});
