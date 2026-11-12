import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';
import { readySource, S01_TITLE } from '../footage';

const footage = (p: string) => fileURLToPath(new URL(`../../../../../footage/${p}`, import.meta.url));
const TALK = footage('clips/talkinghead-th-portrait.mp4'); // real Thai speech, 54.5 s, MANIFEST C03

test.describe.configure({ timeout: 300_000 });

/** Starts recording rAF frame deltas and long tasks in the page. */
async function startPerf(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __perf: { deltas: number[]; long: number[]; loaf: string[]; on: boolean };
    };
    w.__perf = { deltas: [], long: [], loaf: [], on: true };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration);
    }).observe({ type: 'longtask' });
    // attribution for any long frame (Long Animation Frames API): which script ran, so a failure says why
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as {
        duration: number;
        blockingDuration: number;
        scripts: { invoker: string; sourceFunctionName: string; sourceURL: string; duration: number }[];
      }[]) {
        if (e.blockingDuration <= 0) continue;
        const scripts = e.scripts.map(
          (s) =>
            `${s.invoker} ${s.sourceFunctionName}@${s.sourceURL.split('/').pop()?.split('?')[0]} ${Math.round(s.duration)}ms`,
        );
        w.__perf.loaf.push(`${Math.round(e.duration)}ms [${scripts.join('; ')}]`);
      }
    }).observe({ type: 'long-animation-frame' });
    let last = performance.now();
    const loop = (t: number) => {
      w.__perf.deltas.push(t - last);
      last = t;
      if (w.__perf.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

async function stopPerf(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __perf: { deltas: number[]; long: number[]; loaf: string[]; on: boolean };
    };
    w.__perf.on = false;
    const d = w.__perf.deltas.slice(2).sort((a, b) => a - b);
    return {
      frames: d.length,
      p95: d[Math.floor(d.length * 0.95)] ?? 0,
      max: d[d.length - 1] ?? 0,
      longTasks: w.__perf.long,
      blockingFrames: w.__perf.loaf,
    };
  });
}

test('transcribe a real clip → click a word → the player seeks to it; playback highlights words; search', async ({
  page,
}) => {
  await signIn(page, '/library');
  const handedOver = page.waitForResponse(
    (r) => r.url().includes('/api/sources/by-upload/') && r.status() === 200,
  );
  await page.getByTestId('upload-input').setInputFiles(TALK);
  const id = ((await (await handedOver).json()) as { id: string }).id;
  await page.goto(`/library/${id}`);
  await expect(page.getByTestId('transcript-start')).toBeVisible({ timeout: 180_000 });
  await page.getByTestId('transcript-start').click();
  await expect(page.getByTestId('transcript-running')).toBeVisible();
  await page.screenshot({ path: 'test-results/transcript-running.png', fullPage: true });
  const words = page.locator('[data-testid="transcript"] [data-w]');
  await expect(words.first()).toBeVisible({ timeout: 240_000 });
  await page.screenshot({ path: 'test-results/transcript-ready.png', fullPage: true });

  // click a word in the middle → player time within 100 ms of the word start
  const word = words.nth(25);
  const startMs = Number(await word.getAttribute('data-start'));
  expect(startMs).toBeGreaterThan(0);
  await word.click();
  const video = page.getByTestId('proxy-video');
  await video.evaluate(
    (v: HTMLVideoElement) =>
      new Promise((r) => (v.seeking ? v.addEventListener('seeked', r, { once: true }) : r(0))),
  );
  const diff = await video.evaluate(
    (v: HTMLVideoElement, ms: number) => Math.abs(v.currentTime * 1000 - ms),
    startMs,
  );
  console.log(`seek diff ${diff.toFixed(1)} ms (word start ${startMs} ms)`);
  expect(diff).toBeLessThanOrEqual(100);
  await expect(word).toHaveAttribute('data-active', '');

  // play: the highlight moves with the audio clock
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(async () => Number(await page.locator('[data-w][data-active]').first().getAttribute('data-w')), {
      timeout: 10_000,
    })
    .toBeGreaterThan(26);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  await page.screenshot({ path: 'test-results/transcript-playing.png', fullPage: true });

  // search a word that is really in the transcript
  const needle = (await words.nth(5).textContent()) ?? '';
  await page.getByTestId('transcript-search').fill(needle);
  await expect(page.getByTestId('transcript-match-count')).toHaveText(/^1\/\d+$/);
  await page.screenshot({ path: 'test-results/transcript-search.png', fullPage: true });
});

test('correct a word → it survives a reload → revert restores the recognised word', async ({ page }) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  let sourceId: string | undefined;
  for (const s of list.items.filter((x) => x.status === 'ready')) {
    const st = (await (await page.request.get(`/api/sources/${s.id}/transcript`)).json()) as {
      status: string;
    };
    if (st.status === 'ready') {
      sourceId = s.id;
      break;
    }
  }
  test.skip(!sourceId, 'no source with a ready transcript in this dev database (run the first test)');
  await page.goto(`/library/${sourceId}`);
  const word = page.locator('[data-testid="transcript"] [data-w="3"]');
  await expect(word).toBeVisible({ timeout: 30_000 });
  const before = (await word.textContent()) ?? '';
  const fixed = `${before}✓แก้`;

  await word.dblclick();
  const editor = page.getByTestId('word-editor');
  await expect(editor).toBeFocused();
  await page.screenshot({ path: 'test-results/transcript-editing.png', fullPage: true });
  await editor.fill(fixed);
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);
  await expect(word).toHaveText(fixed);
  await expect(word).toHaveAttribute('title', `เดิม: ${before}`);

  await page.reload();
  await expect(word).toHaveText(fixed, { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/transcript-edited.png', fullPage: true });

  await word.dblclick();
  await page.getByRole('button', { name: 'คืนค่าเดิม' }).click();
  await expect(page.getByTestId('word-editor')).toHaveCount(0);
  await expect(word).toHaveText(before);
  await page.reload();
  await expect(word).toHaveText(before, { timeout: 30_000 });
  await expect(word).not.toHaveAttribute('data-edited', '');
});

test('long transcript (45-min live) scrolls at 60 fps', async ({ page }) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string }[];
  };
  const long = readySource(list.items, S01_TITLE);
  test.skip(!long, 'the 45-min live S01 is not ingested + transcribed in this dev database (epic-gate data)');
  if (!long) return;
  const state = (await (await page.request.get(`/api/sources/${long.id}/transcript`)).json()) as {
    status: string;
    segmentCount: number;
  };
  test.skip(state.status !== 'ready', 'S01 has no ready transcript in this dev database');
  await page.goto(`/library/${long.id}`);
  const scroller = page.getByTestId('transcript-scroll');
  await expect(scroller.locator('[data-w]').first()).toBeVisible({ timeout: 30_000 });
  const box = await scroller.boundingBox();
  if (!box) throw new Error('no transcript box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await startPerf(page);
  // ~3 s of continuous wheel scrolling through the long list
  for (let i = 0; i < 180; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  const perf = await stopPerf(page);
  const top = await scroller.evaluate((el) => el.scrollTop);
  console.log(
    `segments ${state.segmentCount} · scrolled ${top}px · frames ${perf.frames} · p95 ${perf.p95.toFixed(1)} ms · max ${perf.max.toFixed(1)} ms · long tasks ${JSON.stringify(perf.longTasks)} · blocking frames ${JSON.stringify(perf.blockingFrames)}`,
  );
  await page.screenshot({ path: 'test-results/transcript-long-scrolled.png', fullPage: true });
  expect(top).toBeGreaterThan(10_000);
  expect(perf.p95).toBeLessThanOrEqual(20);
  expect(perf.longTasks.filter((d) => d > 50)).toEqual([]);
});
