import { describe, expect, it } from 'vitest';
import { buildCaptions } from './caption-layout';
import { balancedLines, phraseTokens } from './text-lines';

// 1 character = 10 px: widths are easy to reason about
const measure = (t: string) => t.length * 10;

describe('phrase tokens (never split a number from what it counts)', () => {
  it('keeps number + unit/noun, measure word + number, size + letter and Latin names together', () => {
    // real end card from an S01a clip (user: "ตกบรรทัด" — it broke as "… ค่าส่ง 2 / ตัวแรก 50 บาท")
    expect(phraseTokens('Liquid Blue ค่าส่ง 2 ตัวแรก 50 บาท')).toEqual([
      'Liquid Blue',
      'ค่าส่ง',
      '2 ตัวแรก',
      '50 บาท',
    ]);
    expect(phraseTokens('ตัวนี้ อก 22 ยาว 29')).toEqual(['ตัวนี้', 'อก 22', 'ยาว 29']);
    expect(phraseTokens('มี ไซซ์ L XL')).toEqual(['มี', 'ไซซ์ L XL']);
    expect(phraseTokens('สวย มาก นะคะ')).toEqual(['สวย', 'มากนะคะ']);
    // real S01a title: a trailing number stays with the word it belongs to ("ตัวละ 10")
    expect(phraseTokens('ค่าส่ง 2 ตัวแรก 50 บาท ตัวต่อไปตัวละ 10')).toEqual([
      'ค่าส่ง',
      '2 ตัวแรก',
      '50 บาท',
      'ตัวต่อไปตัวละ 10',
    ]);
  });
});

describe('balanced lines', () => {
  it('uses the fewest lines, then the most even split (no orphan last line)', () => {
    const tokens = phraseTokens('Liquid Blue ค่าส่ง 2 ตัวแรก 50 บาท'); // widths 110, 60, 80, 60
    const lines = balancedLines(tokens, measure, 200, 3);
    expect(lines).toEqual(['Liquid Blue ค่าส่ง', '2 ตัวแรก 50 บาท']);
  });

  it('one line when it fits; null when a phrase alone is too wide', () => {
    expect(balancedLines(['สวย', 'มาก'], measure, 200, 2)).toEqual(['สวย มาก']);
    expect(balancedLines(['x'.repeat(30)], measure, 200, 2)).toBeNull();
  });

  it('respects maxLines', () => {
    expect(balancedLines(['aaaa', 'bbbb', 'cccc', 'dddd'], measure, 45, 3)).toBeNull();
    expect(balancedLines(['aaaa', 'bbbb', 'cccc', 'dddd'], measure, 45, 4)).toEqual([
      'aaaa',
      'bbbb',
      'cccc',
      'dddd',
    ]);
  });
});

describe('one-line caption pages', () => {
  const w = (text: string, i: number) => ({ text, startFrame: i * 10, endFrame: i * 10 + 9 });
  // real S01a tokens (ASR) of "ตัวนี้ อก 22 ยาว 29 ราคา 80 บาท ค่ะ"
  const words = ['ตัวนี้', 'อก', '22', 'ยาว', '29', 'ราคา', '80', 'บาท', 'ค่ะ'].map(w);

  it('pages hold at most maxWords phrases on ONE line and never split a number from its unit/measure word', () => {
    const pages = buildCaptions(words, { measure, maxWidth: 400, maxLines: 1, pauseFrames: 15, maxWords: 3 });
    const texts = pages.map((p) => p.words.map((x) => x.text));
    expect(pages.every((p) => p.lines.length === 1)).toBe(true);
    expect(texts.flat().join('|')).toBe('ตัวนี้|อก 22|ยาว 29|ราคา 80 บาทค่ะ');
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(3);
  });

  it('balances pages: no 1-phrase page left over at the end of a run', () => {
    const pages = buildCaptions(words, { measure, maxWidth: 400, maxLines: 1, pauseFrames: 15, maxWords: 3 });
    // 4 phrases with max 3 → 2 + 2, not 3 + 1
    expect(pages.map((p) => p.words.length)).toEqual([2, 2]);
  });

  it('a page also breaks when one line would be too wide', () => {
    const pages = buildCaptions(words, { measure, maxWidth: 140, maxLines: 1, pauseFrames: 15, maxWords: 4 });
    expect(pages.every((p) => p.lines.length === 1)).toBe(true);
    for (const p of pages) expect(measure(p.words.map((x) => x.text).join(' '))).toBeLessThanOrEqual(140);
  });

  it('without maxWords the old behaviour stays (2-line pages)', () => {
    const pages = buildCaptions(words, { measure, maxWidth: 120, maxLines: 2, pauseFrames: 15 });
    expect(pages.some((p) => p.lines.length === 2)).toBe(true);
  });
});
