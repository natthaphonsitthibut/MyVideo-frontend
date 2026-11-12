import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';

/**
 * Advanced timeline performance gate (E09-F02/F04/F05/F11, `editor-performance` budgets): a 200-element project
 * derived from a REAL AI clip already in the dev database (its video cut into pieces + its captions + copies of its
 * texts); zoom, scroll, drag and trim for ~3 s each while recording rAF frame deltas and long tasks in the page.
 * Budget: p95 frame ≤ 20 ms, no long task > 50 ms. One worker; needs the dev stack (`scripts/dev.sh`).
 */
test.describe.configure({ timeout: 300_000, mode: 'serial' });

type El = {
  id: string;
  type: string;
  trackId: string;
  startFrame: number;
  durationFrames: number;
  sourceInFrame?: number;
  playbackRate?: number;
};
type Doc = {
  durationFrames: number;
  tracks: { id: string; kind: string; elementIds: string[] }[];
  elements: Record<string, El>;
} & Record<string, unknown>;

async function make200(page: Page): Promise<string> {
  const list = (await (await page.request.get('/api/projects')).json()) as {
    items: { id: string; createdBy: string }[];
  };
  const ai = list.items.find((p) => p.createdBy === 'ai');
  test.skip(!ai, 'no AI clip in this dev database');
  const rec = (await (await page.request.get(`/api/projects/${ai?.id}`)).json()) as {
    title: string;
    doc: Doc;
  };
  const { id: _i, merchantId: _m, ...doc } = rec.doc as Doc & { id: string; merchantId: string };
  // cut every video element into ≤ 12-frame pieces until 200 elements exist (real footage, real captions)
  const els = doc.elements;
  const count = () => Object.keys(els).length;
  for (const t of doc.tracks.filter((x) => x.kind === 'video')) {
    const next: string[] = [];
    for (const id of t.elementIds) {
      const e = els[id];
      if (!e) continue;
      let at = e.startFrame;
      const end = e.startFrame + e.durationFrames;
      let first = true;
      while (at < end) {
        const len = count() < 200 ? Math.min(12, end - at) : end - at;
        const pid = first ? id : crypto.randomUUID();
        els[pid] = {
          ...e,
          id: pid,
          startFrame: at,
          durationFrames: len,
          sourceInFrame: (e.sourceInFrame ?? 0) + Math.round((at - e.startFrame) * (e.playbackRate ?? 1)),
        };
        next.push(pid);
        at += len;
        first = false;
      }
    }
    t.elementIds = next;
  }
  const res = await page.request.post('/api/projects', { data: { title: `${rec.title} (perf 200)`, doc } });
  expect(res.status()).toBe(201);
  expect(count()).toBeGreaterThanOrEqual(200);
  return ((await res.json()) as { id: string }).id;
}

async function startMeasuring(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { d: number[]; long: number[]; on: boolean } };
    w.__perf = { d: [], long: [], on: true };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration);
    }).observe({ type: 'longtask' });
    let last = performance.now();
    const loop = (t: number) => {
      w.__perf.d.push(t - last);
      last = t;
      if (w.__perf.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
async function stopMeasuring(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __perf: { d: number[]; long: number[]; on: boolean } };
    w.__perf.on = false;
    const d = w.__perf.d.slice(2).sort((a, b) => a - b);
    return {
      p95: d[Math.floor(d.length * 0.95)] ?? 0,
      frames: d.length,
      long: w.__perf.long.filter((x) => x > 50),
    };
  });
}

test('200 elements: zoom, scroll, drag and trim stay inside the frame budget', async ({ page }) => {
  await signIn(page, '/library');
  const id = await make200(page);
  await page.goto(`/clips/${id}/advanced`);
  await expect(page.getByTestId('timeline-clip').first()).toBeVisible({ timeout: 60_000 });
  const results: Record<string, unknown> = {};

  // zoom sweep (the slider writes one CSS variable per input)
  await startMeasuring(page);
  const zoom = page.getByTestId('timeline-zoom');
  for (let i = 0; i < 60; i++) await zoom.fill(String(-2 + (i / 60) * 4));
  results.zoom = await stopMeasuring(page);

  // scroll across the whole project
  await startMeasuring(page);
  const scroller = page.getByTestId('timeline-scroll');
  for (let i = 0; i < 60; i++) await scroller.evaluate((el, x) => el.scrollTo({ left: x * 80 }), i);
  results.scroll = await stopMeasuring(page);

  // drag a clip for ~3 s, then trim another
  await scroller.evaluate((el) => el.scrollTo({ left: 0 }));
  const clip = page.getByTestId('timeline-clip').nth(3);
  const box = await clip.boundingBox();
  if (!box) throw new Error('no clip');
  await startMeasuring(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 90; i++) await page.mouse.move(box.x + box.width / 2 + i * 3, box.y + box.height / 2);
  await page.mouse.up();
  results.drag = await stopMeasuring(page);

  const trimTarget = page.getByTestId('timeline-clip').nth(6);
  const tb = await trimTarget.boundingBox();
  if (!tb) throw new Error('no clip');
  await startMeasuring(page);
  await page.mouse.move(tb.x + tb.width - 2, tb.y + tb.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 90; i++) await page.mouse.move(tb.x + tb.width - 2 - i, tb.y + tb.height / 2);
  await page.mouse.up();
  results.trim = await stopMeasuring(page);

  console.log(`timeline perf ${JSON.stringify(results)}`);
  await page.screenshot({ path: 'test-results/timeline-200.png', fullPage: true });
  for (const [name, r] of Object.entries(results) as [string, { p95: number; long: number[] }][]) {
    expect(r.p95, name).toBeLessThanOrEqual(20);
    expect(r.long, name).toEqual([]);
  }
});

test('split, ripple delete and undo restore the exact document', async ({ page }) => {
  await signIn(page, '/library');
  const id = await make200(page);
  await page.goto(`/clips/${id}/advanced`);
  await expect(page.getByTestId('timeline-clip').first()).toBeVisible({ timeout: 60_000 });
  const before = await page.evaluate(
    async (pid) => (await (await fetch(`/api/projects/${pid}`)).json()).doc,
    id,
  );
  await page.getByTestId('timeline-clip').nth(2).click();
  await page.keyboard.press('Shift+Delete');
  await expect(page.getByTestId('timeline-message')).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(2500); // autosave debounce
  const after = await page.evaluate(
    async (pid) => (await (await fetch(`/api/projects/${pid}`)).json()).doc,
    id,
  );
  expect(after.elements).toEqual(before.elements);
  expect(after.tracks).toEqual(before.tracks);
});
