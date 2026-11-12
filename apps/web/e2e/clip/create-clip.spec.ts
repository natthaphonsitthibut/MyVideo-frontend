import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { signIn } from '../auth';

/**
 * E05-F07 acceptance on REAL data: the 45-min live S01 (MANIFEST S01) with its real transcript. Select words in the
 * transcript → "สร้างคลิป" → clip page → reload → the preview shows the selected source segment and the caption
 * word highlighted at each checked frame is the word the project says is spoken there.
 */
const FOOTAGE = fileURLToPath(new URL('../../../../../footage', import.meta.url));
test.skip(!existsSync(`${FOOTAGE}/MANIFEST.md`), 'workspace footage not available');
test.describe.configure({ timeout: 240_000 });

type Word = { text: string; startMs: number; endMs: number };
type Seg = { seq: number; startMs: number; endMs: number; text: string; words: Word[] };
type Doc = {
  fps: { num: number; den: number };
  durationFrames: number;
  elements: Record<
    string,
    {
      type: string;
      startFrame: number;
      durationFrames: number;
      sourceInFrame?: number;
      words?: { text: string; startFrame: number; endFrame: number }[];
    }
  >;
};
const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '');

/** The caption word the project says is spoken at clip frame `f` ('' in a pause). */
function expectedWordAt(doc: Doc, f: number): string {
  for (const e of Object.values(doc.elements)) {
    if (e.type !== 'caption' || f < e.startFrame || f >= e.startFrame + e.durationFrames) continue;
    const w = e.words?.find((x) => f - e.startFrame >= x.startFrame && f - e.startFrame < x.endFrame);
    return w?.text ?? '';
  }
  return '';
}

/** Frame on the preview clock, the video's own source frame, and the highlighted caption word. */
async function readPreview(page: Page, fps: number) {
  return page.evaluate((fpsN) => {
    const stage = document.querySelector('[data-testid="preview-stage"]');
    const v = stage?.querySelector('video');
    const track = document.querySelector('[data-testid="preview-track"]');
    return {
      frame: Number(track?.getAttribute('aria-valuenow')),
      videoFrame: v ? Math.round(v.currentTime * fpsN) : -1,
      active: stage?.querySelector('[data-active]')?.textContent ?? '',
    };
  }, fps);
}

test('select words in the real S01 transcript → สร้างคลิป → reload → preview plays that segment with captions in sync', async ({
  page,
}) => {
  await signIn(page, '/library');
  const list = (await (await page.request.get('/api/sources?limit=100')).json()) as {
    items: { id: string; title: string; status: string; fps: { num: number; den: number } | null }[];
  };
  const s01 = list.items.find((s) => s.title.includes('ZXgMkBc01mI') && s.status === 'ready');
  test.skip(!s01?.fps, 'S01 is not ingested in this dev database');
  if (!s01?.fps) return;
  const fps = s01.fps.num / s01.fps.den;

  // the real transcript, all pages
  const segs: Seg[] = [];
  for (let from: number | null = 0; from !== null; ) {
    const r = (await (
      await page.request.get(`/api/sources/${s01.id}/transcript/segments?from=${from}&limit=1000`)
    ).json()) as { items: Seg[]; nextFrom: number | null };
    segs.push(...r.items);
    from = r.nextFrom;
  }
  test.skip(segs.length === 0, 'S01 has no ready transcript in this dev database');

  // a segment after 12:00 with ≥ 8 words whose text is unique (so the search lands on it)
  const counts = new Map<string, number>();
  for (const s of segs) counts.set(norm(s.text), (counts.get(norm(s.text)) ?? 0) + 1);
  const pos = segs.findIndex(
    (s) => s.startMs >= 720_000 && s.words.length >= 8 && counts.get(norm(s.text)) === 1,
  );
  const seg = segs[pos];
  if (!seg) throw new Error('no suitable segment');
  const firstGlobal = segs.slice(0, pos).reduce((n, s) => n + s.words.length, 0);
  const pick = { from: 1, to: seg.words.length - 2 }; // a range inside the segment, not the whole row
  const picked = seg.words.slice(pick.from, pick.to + 1);

  await page.goto(`/library/${s01.id}`);
  await expect(page.getByTestId('transcript-scroll')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('transcript-search').fill(seg.text);
  await expect(page.getByTestId('transcript-match-count')).toHaveText('1/1');
  await page.getByTestId('transcript-search').press('Enter');
  const a = page.locator(`[data-testid="transcript-scroll"] [data-w="${firstGlobal + pick.from}"]`);
  const b = page.locator(`[data-testid="transcript-scroll"] [data-w="${firstGlobal + pick.to}"]`);
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();

  // drag-select from the first to the last picked word
  const ab = await a.boundingBox();
  const bb = await b.boundingBox();
  if (!ab || !bb) throw new Error('no word boxes');
  await page.mouse.move(ab.x + 1, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2, { steps: 3 });
  await page.mouse.move(bb.x + bb.width - 1, bb.y + bb.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId('clip-bar')).toContainText(`เลือก ${picked.length} คำ`);
  await page.screenshot({ path: 'test-results/clip-selected.png' });

  await page.getByTestId('clip-create').click();
  await expect(page).toHaveURL(/\/clips\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const id = page.url().split('/').pop() ?? '';

  // the saved project: the right source range and exactly the picked words as captions
  const rec = (await (await page.request.get(`/api/projects/${id}`)).json()) as {
    title: string;
    version: number;
    doc: Doc;
  };
  expect(rec.version).toBe(1);
  const first = picked[0] as Word;
  const last = picked[picked.length - 1] as Word;
  const inFrame = Math.max(0, Math.floor(((first.startMs - 150) * fps) / 1000));
  const outFrame = Math.ceil(((last.endMs + 300) * fps) / 1000);
  const video = Object.values(rec.doc.elements).find((e) => e.type === 'video');
  expect(video?.sourceInFrame).toBe(inFrame);
  expect(rec.doc.durationFrames).toBe(outFrame - inFrame);
  const captionText = Object.values(rec.doc.elements)
    .filter((e) => e.type === 'caption')
    .sort((x, y) => x.startFrame - y.startFrame)
    .flatMap((e) => e.words?.map((w) => w.text) ?? [])
    .join('');
  expect(norm(captionText)).toBe(norm(picked.map((w) => w.text).join('')));

  // reload: the clip comes back from the server
  await page.reload();
  await expect(page.getByTestId('clip-title')).toHaveText(rec.title);
  await expect(page.getByTestId('preview-stage').locator('video')).toHaveCount(1);
  await page.waitForTimeout(1500); // proxy + font warm-up

  const checks: { frame: number; videoFrame: number; active: string; expected: string }[] = [];
  const check = async () => {
    const r = await readPreview(page, fps);
    checks.push({ ...r, expected: expectedWordAt(rec.doc, r.frame) });
  };
  // play ~2 s, pause, check
  await page.getByTestId('preview-toggle').click();
  await page.waitForTimeout(2000);
  await page.getByTestId('preview-toggle').click();
  await page.waitForTimeout(300);
  await check();
  // seek by clicking at 60 % of the track, then step frames with the keyboard
  const track = page.getByTestId('preview-track');
  const box = await track.boundingBox();
  if (!box) throw new Error('no track');
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.waitForTimeout(500);
  await check();
  await track.press('Shift+ArrowLeft');
  await page.waitForTimeout(400);
  await check();
  await page.screenshot({ path: 'test-results/clip-preview.png' });
  console.log(`clip ${id} in=${inFrame} len=${rec.doc.durationFrames} checks ${JSON.stringify(checks)}`);

  expect(checks[0]?.frame).toBeGreaterThan(30); // playback really advanced
  for (const c of checks) {
    // the picture is the selected source segment at that frame (±1 frame)
    expect(Math.abs(c.videoFrame - (inFrame + c.frame))).toBeLessThanOrEqual(1);
    // the highlighted caption word is the one spoken at that frame
    expect(c.active).toBe(c.expected);
  }
  expect(checks.some((c) => c.expected !== '')).toBe(true); // at least one check landed on a word
});
