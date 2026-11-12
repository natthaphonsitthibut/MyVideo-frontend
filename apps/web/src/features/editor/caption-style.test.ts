import { describe, expect, it } from 'vitest';
import { CAPTION_POSITIONS, restyleCaptions } from './caption-style';

const cap = (id: string, words: string[], y = 330) => ({
  type: 'caption' as const,
  id,
  trackId: 't',
  startFrame: 0,
  durationFrames: 30,
  origin: 'ai' as const,
  styleRef: 'pop-word',
  transform: { x: 0, y, scale: 1, rotation: 0 },
  words: words.map((text, i) => ({ text, startFrame: i * 5, endFrame: i * 5 + 5 })),
  lines: [words.map((_, i) => i)],
});
// real S01a pages
const doc = {
  elements: {
    a: cap('a', ['รับ', 'พิมพ์', 'รับมา']),
    b: cap('b', ['ราคา 80 บาท', 'ค่ะ']),
    h: { type: 'text', id: 'h', content: 'hook' },
  },
} as const;

describe('caption look and position', () => {
  it('sets one look and one height for every caption page and lays the lines out again for that look', () => {
    const measure = (font: string) => (t: string) => t.length * (font.includes('900') ? 60 : 20);
    const cmd = restyleCaptions({ styleRef: 'clean', y: CAPTION_POSITIONS.middle }, (style) => ({
      measure: measure(style),
      maxWidth: 200,
    }));
    const draft = structuredClone(doc) as unknown as Parameters<typeof cmd.apply>[0];
    cmd.apply(draft);
    const a = draft.elements.a as unknown as ReturnType<typeof cap>;
    expect(a.styleRef).toBe('clean');
    expect(a.transform.y).toBe(CAPTION_POSITIONS.middle);
    expect(a.lines.flat()).toEqual([0, 1, 2]);
    // the text element is untouched
    expect((draft.elements.h as unknown as { content: string }).content).toBe('hook');
  });

  it('positions are inside the frame and ordered top < middle < bottom', () => {
    expect(CAPTION_POSITIONS.top).toBeLessThan(CAPTION_POSITIONS.middle);
    expect(CAPTION_POSITIONS.middle).toBeLessThan(CAPTION_POSITIONS.bottom);
    expect(Math.abs(CAPTION_POSITIONS.top)).toBeLessThan(960);
    expect(CAPTION_POSITIONS.bottom).toBeLessThan(960);
  });
});
