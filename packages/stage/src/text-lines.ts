import type { Measure } from './caption-layout';

/**
 * Phrase-aware line breaking for titles (hook, end card, graphics). Breaks only between phrases, never inside
 * "number + what it counts", and picks the most even split so no line is left with a lone word.
 */

/** Thai final particles: ride with the word before (no space). */
export const PARTICLES = new Set([
  'ค่ะ',
  'คะ',
  'ครับ',
  'ครับผม',
  'นะ',
  'นะคะ',
  'นะครับ',
  'จ้ะ',
  'จ้า',
  'จ๊ะ',
  'เลย',
  'ด้วย',
  'หรอ',
  'เหรอ',
  'ไหม',
  'มั้ย',
  'สิ',
  'ล่ะ',
  'เนอะ',
  'เนาะ',
]);
/** Words that introduce a number or size and belong with it ("อก 22", "ราคา 80 บาท", "ไซซ์ L"). */
export const MEASURE_WORDS = new Set([
  'อก',
  'เอว',
  'ยาว',
  'สะโพก',
  'ไหล่',
  'แขน',
  'ไซซ์',
  'ไซส์',
  'ไซต์',
  'ไซ',
  'size',
  'Size',
  'ราคา',
  'เบอร์',
]);
export const NUMBER = /^[฿$]?\d[\d,.:]*%?$/;
const SIZE_LETTER = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|F|FREE|Free)$/;
const LATIN = /^[A-Za-z][A-Za-z0-9'&.-]*$/;
const lastPart = (s: string) => s.split(' ').at(-1) ?? s;

/** Space-separated title → phrases that must stay on one line. */
export function phraseTokens(text: string): string[] {
  const out: string[] = [];
  for (const tok of text.split(/\s+/).filter((t) => t.length > 0)) {
    const prev = out.at(-1);
    if (prev !== undefined) {
      const tail = lastPart(prev);
      const join = (sep: string) => {
        out[out.length - 1] = `${prev}${sep}${tok}`;
      };
      if (PARTICLES.has(tok)) {
        join('');
        continue;
      }
      // a number takes the word it counts ("2 ตัวแรก", "50 บาท"); a measure word takes its number / size letters
      const numberTakesWord = NUMBER.test(tail) && !MEASURE_WORDS.has(tok) && !NUMBER.test(tok);
      const measureTakesValue = MEASURE_WORDS.has(tail) && (NUMBER.test(tok) || SIZE_LETTER.test(tok));
      const sizeRun = SIZE_LETTER.test(tail) && SIZE_LETTER.test(tok);
      if (numberTakesWord || measureTakesValue || sizeRun) {
        join(' ');
        continue;
      }
      // a Latin name stays whole ("Liquid Blue")
      if (LATIN.test(tail) && LATIN.test(tok) && !SIZE_LETTER.test(tok)) {
        join(' ');
        continue;
      }
    }
    out.push(tok);
  }
  // a number left on its own (end of the text, or before a measure word) belongs to the word before it
  for (let i = out.length - 1; i > 0; i--) {
    if (NUMBER.test(out[i] as string)) {
      out[i - 1] = `${out[i - 1]} ${out[i]}`;
      out.splice(i, 1);
    }
  }
  return out;
}

/**
 * Fewest lines (≤ maxLines) whose widths fit `maxWidth`, then the split with the narrowest widest line (balanced).
 * Null when it cannot fit (caller tries a smaller font).
 */
export function balancedLines(
  tokens: readonly string[],
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): string[] | null {
  const n = tokens.length;
  if (n === 0) return [];
  const width = (a: number, b: number) => measure(tokens.slice(a, b).join(' '));
  for (let k = 1; k <= Math.min(maxLines, n); k++) {
    // best[j][i]: smallest possible widest line splitting tokens[0..i) into j lines
    const best: number[][] = Array.from({ length: k + 1 }, () =>
      new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY),
    );
    const cut: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(n + 1).fill(-1));
    (best[0] as number[])[0] = 0;
    for (let j = 1; j <= k; j++) {
      for (let i = j; i <= n; i++) {
        for (let s = j - 1; s < i; s++) {
          const prevBest = (best[j - 1] as number[])[s] as number;
          if (!Number.isFinite(prevBest)) continue;
          const w = width(s, i);
          if (w > maxWidth) continue;
          const v = Math.max(prevBest, w);
          if (v < ((best[j] as number[])[i] as number)) {
            (best[j] as number[])[i] = v;
            (cut[j] as number[])[i] = s;
          }
        }
      }
    }
    if (Number.isFinite((best[k] as number[])[n] as number)) {
      const lines: string[] = [];
      let i = n;
      for (let j = k; j >= 1; j--) {
        const s = (cut[j] as number[])[i] as number;
        lines.unshift(tokens.slice(s, i).join(' '));
        i = s;
      }
      return lines;
    }
  }
  return null;
}
