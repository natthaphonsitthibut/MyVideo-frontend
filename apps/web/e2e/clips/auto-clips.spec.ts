import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';

/**
 * E07-F08 — automatic clips through the UI on REAL footage (C02, 55 s Thai live selling): upload → ingest →
 * transcribe → "สร้างคลิปอัตโนมัติ" → recommended styles → pick one → cards turn ready one by one → preview plays → open a clip → discard one →
 * the edited-clips page lists the generated projects. Uses the dev worker's LLM_MODE (local-agent by default).
 * Needs the dev stack started by `scripts/dev.sh`.
 */
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const CLIP = `${ROOT}footage/clips/live-tiedye-th-vertical-b.mp4`;
test.skip(!existsSync(CLIP), 'workspace footage not available');
test.describe.configure({ timeout: 900_000, mode: 'serial' });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/clips-${name}.png`, fullPage: true });

test('generate clips from a real live clip, review, preview, open, discard', async ({ page }) => {
  await signIn(page, '/library');
  const handedOver = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await page.getByTestId('upload-input').setInputFiles(CLIP);
  const sourceId = ((await (await handedOver).json()) as { id: string }).id;
  await page.goto(`/library/${sourceId}`);

  // before a transcript exists the panel explains what to do first (empty state)
  const panel = page.getByTestId('auto-clips');
  await expect(page.getByTestId('transcript-start')).toBeVisible({ timeout: 180_000 });
  await expect(panel).toContainText('ถอดเสียงวิดีโอนี้ก่อน');
  await shot(page, '1-before-transcript');

  await page.getByTestId('transcript-start').click();
  await expect(page.locator('[data-testid="transcript"] [data-w]').first()).toBeVisible({ timeout: 300_000 });

  // generate (with a merchant product name)
  await page.locator('#clip-product').fill('เสื้อมัดย้อม');
  const t0 = Date.now();
  await page.getByTestId('clips-generate').click();
  await expect(page.getByTestId('clips-progress')).toBeVisible();
  await shot(page, '2-running');

  // the analysis ends with recommended styles; nothing is edited before the merchant picks one
  const chooser = page.getByTestId('style-chooser');
  await expect(chooser).toBeVisible({ timeout: 300_000 });
  await expect(chooser.locator('label')).toHaveCount(5);
  await expect(chooser.locator('label').first()).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-testid="clip-card"][data-status="ready"]')).toHaveCount(0);
  await shot(page, '2b-choose-style');
  const picked = (await chooser.locator('label').first().getAttribute('data-testid'))?.replace('advice-', '');
  await page.getByTestId('clips-build').click();
  await expect(page.getByTestId('clips-style')).toBeVisible({ timeout: 30_000 });

  // the first card becomes ready while the run may still be building the others
  const cards = page.getByTestId('clip-card');
  await expect(cards.first()).toBeVisible({ timeout: 300_000 });
  await expect(page.locator('[data-testid="clip-card"][data-status="ready"]').first()).toBeVisible({
    timeout: 300_000,
  });
  const firstReadyAt = Date.now() - t0;
  const snapshot = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
  await expect(panel).toHaveAttribute('data-run-status', 'succeeded', { timeout: 300_000 });
  const doneAt = Date.now() - t0;
  const total = await cards.count();
  console.log(
    `clips: ${total} · first ready after ${(firstReadyAt / 1000).toFixed(1)} s (statuses then: ${snapshot.join(',')}) · all done after ${(doneAt / 1000).toFixed(1)} s`,
  );
  expect(total).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="clip-card"][data-status="ready"]')).toHaveCount(total);
  await expect(page.getByTestId('clips-progress')).toHaveCount(0);
  await shot(page, '3-ready');

  // every card: title, score 0–100, reason; each ready card's project is a valid 9:16 clip within 15–60 s
  const state = (await (await page.request.get(`/api/sources/${sourceId}/clips`)).json()) as {
    clips: { projectId: string; startMs: number; endMs: number; score: number; title: string }[];
  };
  for (const c of state.clips) {
    expect(c.endMs - c.startMs).toBeGreaterThanOrEqual(15_000);
    expect(c.endMs - c.startMs).toBeLessThanOrEqual(60_000);
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(100);
    const p = (await (await page.request.get(`/api/projects/${c.projectId}`)).json()) as {
      doc: { width: number; height: number; meta: { createdBy: string } };
    };
    expect([p.doc.width, p.doc.height, p.doc.meta.createdBy]).toEqual([1080, 1920, 'ai']);
    expect((p.doc.meta as { styleId?: string }).styleId).toBe(picked);
  }

  // preview plays inside the card
  const first = cards.first();
  await first.getByRole('button', { name: 'ดูตัวอย่าง' }).click();
  const preview = page.getByTestId('clip-preview');
  await expect(preview.getByTestId('preview-stage')).toBeVisible({ timeout: 30_000 });
  const time = () => preview.getByTestId('preview-track').getAttribute('aria-valuenow');
  const before = await time();
  await preview.getByTestId('preview-toggle').click();
  await expect.poll(time, { timeout: 10_000 }).not.toBe(before);
  await preview.getByTestId('preview-toggle').click();
  await shot(page, '4-preview');

  // open the clip page (the editable project)
  const firstTitle = (await first.getByTestId('clip-title').textContent()) ?? '';
  await first.getByRole('link', { name: 'เปิดคลิป' }).click();
  await expect(page).toHaveURL(new RegExp(`/clips/[0-9a-f-]{36}\\?source=${sourceId}$`));
  await expect(page.getByTestId('clip-title')).toHaveText(firstTitle);
  await shot(page, '5-clip-page');

  // discard the last card; it stays gone after a reload
  await page.goto(`/library/${sourceId}`);
  await expect(cards).toHaveCount(total, { timeout: 30_000 });
  await cards.last().getByRole('button', { name: 'ทิ้ง' }).click();
  await expect(cards).toHaveCount(total - 1);
  await page.reload();
  await expect(cards).toHaveCount(total - 1, { timeout: 30_000 });

  // The separate edited-clips page keeps all timelines, including a discarded suggestion's timeline.
  await page.goto('/clips');
  await expect(page.getByTestId('edited-clip-row').first()).toBeVisible();
  expect(await page.getByLabel('สร้างอัตโนมัติ').count()).toBeGreaterThanOrEqual(total);
  await shot(page, '6-clips-menu');
});

test('partial and failed states render readable Thai (responses stubbed for a visual check only)', async ({
  page,
}) => {
  await signIn(page, '/library');
  const sources = (await (await page.request.get('/api/sources')).json()) as {
    items: { id: string; status: string; hasAudio: boolean }[];
  };
  const src = sources.items.find((s) => s.status === 'ready' && s.hasAudio);
  test.skip(!src, 'no ready source (run the first test)');
  const id = src?.id ?? '';
  const card = (rank: number, status: string) => ({
    id: `00000000-0000-4000-8000-00000000000${rank}`,
    rank,
    status,
    startMs: rank * 20_000,
    endMs: rank * 20_000 + 25_000,
    score: 90 - rank * 10,
    type: 'price-promo',
    reason: 'price ×3 (80 บาท) · cta ×2 (รับพิม)',
    quote: null,
    hook: null,
    title: 'เสื้อมัดย้อม 80 บาท',
    origin: 'rules',
    projectId: null,
    error: status === 'failed' ? 'สร้างคลิปนี้ไม่สำเร็จ ลองกด "สร้างใหม่" อีกครั้ง' : null,
  });
  let body: unknown = {
    runId: card(1, 'x').id,
    status: 'running',
    mode: 'rules',
    phase: 'building',
    styleId: 'sale-fast',
    advice: { origin: 'rules', items: [{ styleId: 'sale-fast', name: 'ขายไว ไฟลุก', reason: 'พูดราคาบ่อย' }] },
    clips: [card(1, 'planned'), card(2, 'failed')],
  };
  await page.route(`**/api/sources/${id}/clips`, (r) => r.fulfill({ json: body }));
  await page.goto(`/library/${id}`);
  await expect(page.getByTestId('clips-progress')).toContainText('ตัดต่อแล้ว 0 จาก 2 (สไตล์ ขายไว ไฟลุก)');
  await expect(page.getByText('กำลังตัดต่อคลิปนี้…')).toBeVisible();
  await expect(page.getByText('สร้างคลิปนี้ไม่สำเร็จ')).toBeVisible();
  await shot(page, '7-partial');
  body = {
    runId: card(1, 'x').id,
    status: 'failed',
    mode: 'rules',
    phase: 'failed',
    styleId: null,
    advice: null,
    clips: [],
  };
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'สร้างคลิปไม่สำเร็จ' })).toBeVisible();
  await expect(page.getByTestId('clips-generate')).toBeEnabled();
  await shot(page, '8-failed');
  body = {
    runId: card(1, 'x').id,
    status: 'succeeded',
    mode: 'rules',
    phase: 'done',
    styleId: null,
    advice: null,
    clips: [],
  };
  await page.reload();
  await expect(page.getByTestId('clips-empty')).toBeVisible();
  await shot(page, '9-empty');
});
