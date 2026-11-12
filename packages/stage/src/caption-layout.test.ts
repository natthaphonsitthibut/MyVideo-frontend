import { describe, expect, it } from 'vitest';
import { buildCaptions, glueWords, layoutLines, lineText, WORD_GAP } from './caption-layout';

const w = (text: string, startFrame: number, endFrame: number) => ({ text, startFrame, endFrame });
/** Test measure: 40 px per code point, 10 px per word gap (real layout uses canvas measureText on the bundled font). */
const measure = (s: string) => [...s].reduce((n, c) => n + (c === WORD_GAP ? 10 : 40), 0);

describe('glueWords (E01 rules)', () => {
  it('currency + number, number + % / unit, final particles stick to the previous word', () => {
    // tokens as the backend tokenizer produces them for real live lines
    const out = glueWords([
      w('ราคา', 0, 10),
      w('฿', 10, 12),
      w('39,900', 12, 30),
      w('ลด', 30, 40),
      w('50', 40, 50),
      w('%', 50, 52),
      w('ยาว', 52, 60),
      w('28.5', 60, 70),
      w('นิ้ว', 70, 80),
      w('นะ', 80, 90),
      w('ครับ', 90, 100),
    ]);
    expect(out.map((x) => [x.text, x.startFrame, x.endFrame])).toEqual([
      ['ราคา', 0, 10],
      ['฿39,900', 10, 30],
      ['ลด', 30, 40],
      ['50%', 40, 52],
      ['ยาว', 52, 60],
      ['28.5 นิ้วนะครับ', 60, 100],
    ]);
  });

  it('a particle at the very start stays a word (nothing to glue to)', () => {
    expect(glueWords([w('ค่ะ', 0, 5), w('ไซส์', 5, 10)]).map((x) => x.text)).toEqual(['ค่ะ', 'ไซส์']);
  });
});

describe('layoutLines (greedy fill, measured)', () => {
  it('fills lines up to the width, never splits a word', () => {
    const words = ['ตัวนี้', 'เป็น', 'ไซส์', 'เอม', 'ผู้หญิง', 'นะคะ'].map((t, i) => w(t, i * 10, i * 10 + 10));
    const lines = layoutLines(words, measure, 480); // 12 code points per line (words joined with a 0.25 em gap)
    for (const l of lines) {
      const width = measure(lineText(words, l));
      expect(width).toBeLessThanOrEqual(480);
    }
    expect(lines.flat()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('a single word wider than the line gets a line of its own', () => {
    const words = [w('ก', 0, 1), w('ภาษาไทยยาวมากกกกกกกก', 1, 2), w('ข', 2, 3)];
    expect(layoutLines(words, measure, 200)).toEqual([[0], [1], [2]]);
  });
});

describe('buildCaptions', () => {
  const words = [
    // real S01 words (12:00–12:05), frames at 30 fps relative to the clip
    w('อบ', 0, 12),
    w('21.5', 12, 30),
    w('ยา', 30, 40),
    w('28.5', 40, 58),
    w('นะ', 58, 66),
    w('เป็นงาน', 90, 110), // 24-frame pause before → new page
    w('ของ', 110, 118),
    w('แบด', 118, 130),
    w('บอย', 130, 140),
    w('นะ', 140, 146),
    w('ครับผม', 146, 160),
  ];

  it('pages of ≤ maxLines lines, split at pauses, timings relative to each page, lines stored', () => {
    // 600 px = 15 code points: page 2 needs 2 lines ("เป็นงาน ของ แบด" | "บอยนะครับผม")
    const caps = buildCaptions(words, { measure, maxWidth: 600, maxLines: 2, pauseFrames: 15 });
    expect(caps.map((c) => [c.startFrame, c.durationFrames])).toEqual([
      [0, 66],
      [90, 70],
    ]);
    const [a, b] = caps;
    expect(a?.words.map((x) => x.text)).toEqual(['อบ', '21.5', 'ยา', '28.5นะ']);
    expect(a?.words[0]).toEqual({ text: 'อบ', startFrame: 0, endFrame: 12 });
    expect(b?.words.map((x) => [x.text, x.startFrame])).toEqual([
      ['เป็นงาน', 0],
      ['ของ', 20],
      ['แบด', 28],
      ['บอยนะครับผม', 40],
    ]);
    for (const c of caps) {
      expect(c.lines.length).toBeLessThanOrEqual(2);
      expect(c.lines.flat()).toEqual(c.words.map((_, i) => i));
    }
  });

  it('a long run is cut into several pages of at most maxLines', () => {
    const many = Array.from({ length: 40 }, (_, i) => w('คำยาวๆ', i * 10, i * 10 + 10));
    const caps = buildCaptions(many, { measure, maxWidth: 480, maxLines: 2, pauseFrames: 15 });
    expect(caps.length).toBeGreaterThan(5);
    for (const c of caps) expect(c.lines.length).toBeLessThanOrEqual(2);
    expect(caps.reduce((n, c) => n + c.words.length, 0)).toBe(40);
    // pages tile without overlap
    for (let i = 1; i < caps.length; i++) {
      const prev = caps[i - 1];
      expect(caps[i]?.startFrame).toBeGreaterThanOrEqual(
        (prev?.startFrame ?? 0) + (prev?.durationFrames ?? 0),
      );
    }
  });
});
