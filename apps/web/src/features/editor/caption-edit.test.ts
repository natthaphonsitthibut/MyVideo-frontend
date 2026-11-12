import { describe, expect, it } from 'vitest';
import { acceptCaptionWord, captionRows, editCaptionWord, revertCaptionWord } from './caption-edit';

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
