import { describe, expect, it } from 'vitest';
import { buildClipDoc, clipRange, clipTitle, MAX_CLIP_SECONDS } from './clip-project';

/**
 * Hand-written word timings shaped like the tokenizer's output (a unit fixture for the frame math — NOT a real
 * transcript; the real S01 transcript is exercised by `e2e/clip/create-clip.spec.ts`).
 */
const WORDS = [
  { text: 'ตัว', startMs: 720_120, endMs: 720_380 },
  { text: 'นี้', startMs: 720_380, endMs: 720_610 },
  { text: 'ราคา', startMs: 720_610, endMs: 721_050 },
  { text: '390', startMs: 721_050, endMs: 721_640 },
  { text: 'บาท', startMs: 721_640, endMs: 721_980 },
  { text: 'นะ', startMs: 721_980, endMs: 722_200 },
  // a 1.4 s pause, then a new sentence → new caption page
  { text: 'ผ้า', startMs: 723_600, endMs: 723_900 },
  { text: 'นิ่ม', startMs: 723_900, endMs: 724_300 },
  { text: 'มาก', startMs: 724_300, endMs: 724_800 },
];
const SOURCE = {
  id: '01a1ce04-c905-710c-973f-d22de49c95eb',
  fps: { num: 30, den: 1 },
  durationFrames: 81_000,
  hasAudio: true,
};
const measure = (s: string) => s.length * 40;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

describe('clipRange', () => {
  it('covers the selected words with a little air, in source frames', () => {
    const r = clipRange(SOURCE, WORDS);
    // 720.12 s − 150 ms = 719.97 s → frame 21599 (floor); 724.8 s + 300 ms = 725.1 s → frame 21753 (ceil)
    expect(r).toEqual({ sourceInFrame: 21_599, durationFrames: 21_753 - 21_599 });
  });

  it('never leaves the source', () => {
    const atStart = clipRange({ ...SOURCE, durationFrames: 120 }, [{ text: 'a', startMs: 50, endMs: 3_950 }]);
    expect(atStart).toEqual({ sourceInFrame: 0, durationFrames: 120 });
  });

  it('works at 29.97 fps', () => {
    const r = clipRange({ ...SOURCE, fps: { num: 30_000, den: 1001 } }, [
      { text: 'a', startMs: 10_000, endMs: 11_000 },
    ]);
    // 9.85 s × 29.97 = 295.2 → 295 ; 11.3 s × 29.97 = 338.66 → 339
    expect(r).toEqual({ sourceInFrame: 295, durationFrames: 44 });
  });
});

describe('clipTitle', () => {
  it('joins Thai words without spaces and shortens long titles', () => {
    expect(clipTitle(WORDS.slice(0, 5))).toBe('ตัวนี้ราคา 390 บาท');
    expect(clipTitle(Array.from({ length: 30 }, () => ({ text: 'สวยมาก' })))).toMatch(/^(สวยมาก)+…$/);
    expect(clipTitle(Array.from({ length: 30 }, () => ({ text: 'สวยมาก' }))).length).toBeLessThanOrEqual(41);
  });
});

describe('buildClipDoc', () => {
  const doc = buildClipDoc({ source: SOURCE, words: WORDS, measure, newId });
  const els = Object.values(doc.elements);
  const video = els.find((e) => e.type === 'video');
  const caps = els.filter((e) => e.type === 'caption');

  it('is a 9:16 project with the source segment filling the frame', () => {
    expect(doc).toMatchObject({ schemaVersion: 1, width: 1080, height: 1920, fps: SOURCE.fps });
    expect(doc.durationFrames).toBe(154);
    const asset = Object.values(doc.assets)[0];
    expect(asset).toEqual({
      sourceId: SOURCE.id,
      kind: 'video',
      durationFrames: SOURCE.durationFrames,
      hasAudio: true,
    });
    expect(video).toMatchObject({
      startFrame: 0,
      durationFrames: 154,
      sourceInFrame: 21_599,
      fit: 'cover',
      playbackRate: 1,
      volume: 1,
      origin: 'user',
    });
  });

  it('puts every selected word into captions at its clip frame, split at the pause', () => {
    expect(caps).toHaveLength(2);
    const words = caps.flatMap((c) =>
      c.type === 'caption' ? c.words.map((w) => ({ ...w, at: c.startFrame + w.startFrame })) : [],
    );
    // glue rules: "ราคา 390 บาท" is one caption phrase (measure word + value + unit), "นะ" rides on it
    expect(words.map((w) => w.text)).toEqual(['ตัว', 'นี้', 'ราคา 390 บาทนะ', 'ผ้า', 'นิ่ม', 'มาก']);
    // 'ตัว' at 720.12 s = source frame 21603.6 → 21604 − 21599 = clip frame 5
    expect(words[0]?.at).toBe(5);
    // 'ผ้า' at 723.6 s = 21708 − 21599 = 109
    expect(words[3]?.at).toBe(109);
    for (const c of caps) {
      expect(c.startFrame).toBeGreaterThanOrEqual(0);
      expect(c.startFrame + c.durationFrames).toBeLessThanOrEqual(doc.durationFrames);
    }
  });

  it('lists every element on its track exactly once', () => {
    const listed = doc.tracks.flatMap((t) => t.elementIds);
    expect(listed.sort()).toEqual(Object.keys(doc.elements).sort());
    for (const t of doc.tracks) for (const id of t.elementIds) expect(doc.elements[id]?.trackId).toBe(t.id);
  });

  it('refuses an empty or too long selection', () => {
    expect(() => buildClipDoc({ source: SOURCE, words: [], measure, newId })).toThrow(/เลือกคำ/);
    const long = [
      { text: 'a', startMs: 0, endMs: 1000 },
      { text: 'b', startMs: MAX_CLIP_SECONDS * 1000, endMs: MAX_CLIP_SECONDS * 1000 + 500 },
    ];
    expect(() => buildClipDoc({ source: SOURCE, words: long, measure, newId })).toThrow(/ยาวเกิน/);
  });
});
