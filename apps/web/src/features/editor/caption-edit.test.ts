import { describe, expect, it } from 'vitest';
import {
  acceptCaptionWord,
  captionRows,
  editCaptionWord,
  mergeCaptionWithNext,
  revertCaptionWord,
  splitCaptionAt,
} from './caption-edit';

// a real S01a caption page (sale-fast, one line): "รับพิมพ์รับมา 1,500 บาท" with an AI correction on พิมพ์
const caption = {
  type: 'caption' as const,
  id: 'c1',
  trackId: 't',
  startFrame: 30,
  durationFrames: 40,
  origin: 'ai' as const,
  styleRef: 'pop-word',
  transform: { x: 0, y: 330, scale: 1, rotation: 0 },
  words: [
    { text: 'รับ', startFrame: 0, endFrame: 8 },
    { text: 'พิมพ์', startFrame: 8, endFrame: 16, origin: 'ai' as const, asrText: 'พิม' },
    { text: 'รับมา', startFrame: 16, endFrame: 26 },
    { text: '1,500 บาท', startFrame: 26, endFrame: 40, emphasis: true as const },
  ],
  lines: [[0, 1, 2, 3]],
};
const measure = (t: string) => t.length * 40;

describe('caption editing', () => {
  it('rows list every caption in time order with AI marks', () => {
    const rows = captionRows({ c1: caption, x: { ...caption, id: 'x', startFrame: 0 } });
    expect(rows.map((r) => r.id)).toEqual(['x', 'c1']);
    expect(rows[1]?.words[1]).toEqual({ text: 'พิมพ์', ai: true, heard: 'พิม' });
  });

  it('editing a word keeps its timing, drops the AI mark and re-lays the lines within the width', () => {
    const r = editCaptionWord(caption, 2, 'รับมาเลยวันนี้', { measure, maxWidth: 600, maxLines: 2 });
    expect(r.words[2]).toEqual({ text: 'รับมาเลยวันนี้', startFrame: 16, endFrame: 26 });
    expect(r.words[3]?.emphasis).toBe(true);
    // 40 px per character, 600 px wide: "รับพิมพ์" 320 | "รับมาเลยวันนี้" 560 | "1,500 บาท" 400 → three lines,
    // every word still shown once and in order
    expect(r.lines).toEqual([[0, 1], [2], [3]]);
    expect(r.lines.flat()).toEqual([0, 1, 2, 3]);
  });

  it('an empty edit is refused (a caption word cannot disappear by typing nothing)', () => {
    expect(() => editCaptionWord(caption, 0, '  ', { measure, maxWidth: 600, maxLines: 2 })).toThrow();
  });

  it('revert goes back to the heard word; accept keeps the AI word and removes the mark', () => {
    const back = revertCaptionWord(caption, 1, { measure, maxWidth: 600, maxLines: 2 });
    expect(back.words[1]).toEqual({ text: 'พิม', startFrame: 8, endFrame: 16 });
    const ok = acceptCaptionWord(caption, 1);
    expect(ok.words[1]).toEqual({ text: 'พิมพ์', startFrame: 8, endFrame: 16 });
    expect(ok.lines).toEqual(caption.lines);
  });
});

type Doc = {
  elements: Record<string, unknown>;
  tracks: { id: string; kind: string; elementIds: string[] }[];
};

describe('caption pages: merge, split', () => {
  const layout = { measure, maxWidth: 2000, maxLines: 2 };
  const next = {
    ...caption,
    id: 'c2',
    startFrame: 80, // 10 frames after c1 ends (30 + 40)
    durationFrames: 20,
    words: [
      { text: 'ส่ง', startFrame: 0, endFrame: 10 },
      { text: 'ฟรี', startFrame: 10, endFrame: 20 },
    ],
    lines: [[0, 1]],
  };
  const doc = (els: Record<string, unknown>): Doc => ({
    elements: structuredClone(els),
    tracks: [{ id: 't', kind: 'caption', elementIds: Object.keys(els) }],
  });

  it('merging a page with the next keeps every word at its audio time and covers both pages', () => {
    const d = doc({ c1: caption, c2: next });
    mergeCaptionWithNext('c1', 'c2', layout).apply(d as never);
    const m = d.elements.c1 as typeof caption;
    expect(d.elements.c2).toBeUndefined();
    expect(d.tracks[0]?.elementIds).toEqual(['c1']);
    expect(m.startFrame).toBe(30);
    expect(m.durationFrames).toBe(70); // 30 → 100
    expect(m.words.map((w) => [w.text, w.startFrame, w.endFrame])).toEqual([
      ['รับ', 0, 8],
      ['พิมพ์', 8, 16],
      ['รับมา', 16, 26],
      ['1,500 บาท', 26, 40],
      ['ส่ง', 50, 60],
      ['ฟรี', 60, 70],
    ]);
    expect(m.lines.flat()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(m.words[1]?.origin).toBe('ai'); // provenance kept
  });

  it('splitting before a word makes a new page that starts at that word', () => {
    const d = doc({ c1: caption });
    splitCaptionAt('c1', 2, 'c9', layout).apply(d as never);
    const a = d.elements.c1 as typeof caption;
    const b = d.elements.c9 as typeof caption;
    expect(a.words.map((w) => w.text)).toEqual(['รับ', 'พิมพ์']);
    expect(a.durationFrames).toBe(16);
    expect(b).toMatchObject({
      id: 'c9',
      type: 'caption',
      startFrame: 46,
      durationFrames: 24,
      styleRef: 'pop-word',
    });
    expect(b.words.map((w) => [w.text, w.startFrame, w.endFrame])).toEqual([
      ['รับมา', 0, 10],
      ['1,500 บาท', 10, 24],
    ]);
    expect(b.lines).toEqual([[0, 1]]);
    expect(d.tracks[0]?.elementIds).toEqual(['c1', 'c9']);
  });

  it('splitting at the first word is refused (a page cannot be empty)', () => {
    const d = doc({ c1: caption });
    expect(() => splitCaptionAt('c1', 0, 'c9', layout).apply(d as never)).toThrow();
  });
});
