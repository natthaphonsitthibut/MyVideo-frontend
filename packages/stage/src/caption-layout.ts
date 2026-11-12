/**
 * Caption builder (E01-F04 decision): word boundaries come from the backend tokenizer (pythainlp); lines are
 * computed ONCE here with a measured greedy fill on the bundled font and stored in the Project JSON; the stage
 * renders each stored line with `white-space: nowrap` — the browser never wraps captions (its ICU Thai
 * dictionary breaks mid-word).
 */
export type TimedWord = { text: string; startFrame: number; endFrame: number };
export type CaptionPage = {
  startFrame: number;
  durationFrames: number;
  words: TimedWord[];
  lines: number[][];
};
export type Measure = (text: string) => number;

/** Thai final particles: never start a line, always ride with the word before. */
const PARTICLES = new Set([
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
  'จ้ะ',
]);
/** Units that belong to the number before them (joined with a space; % without). */
const UNITS = new Set([
  'บาท',
  'นิ้ว',
  'ซม',
  'ซม.',
  'เซน',
  'เซนต์',
  'กก',
  'กก.',
  'กรัม',
  'ตัว',
  'ชิ้น',
  'คู่',
  'ml',
  'g',
  'cm',
  'kg',
  'mm',
]);
const NUMBER = /^[฿$]?\d[\d,.:]*%?$/;
const CURRENCY = new Set(['฿', '$']);

/** Applies the E01 glue rules: ฿+number, number+%/unit, final particles onto the previous word. */
export function glueWords(words: readonly TimedWord[]): TimedWord[] {
  const out: TimedWord[] = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    const join = (sep: string) => {
      if (!prev) return false;
      out[out.length - 1] = {
        text: `${prev.text}${sep}${w.text}`,
        startFrame: prev.startFrame,
        endFrame: w.endFrame,
      };
      return true;
    };
    if (prev && CURRENCY.has(prev.text) && NUMBER.test(w.text) && join('')) continue;
    if (prev && w.text === '%' && NUMBER.test(prev.text) && join('')) continue;
    if (prev && UNITS.has(w.text) && NUMBER.test(prev.text) && join(' ')) continue;
    if (prev && PARTICLES.has(w.text) && join('')) continue;
    out.push({ ...w });
  }
  return out;
}

/**
 * Default gap between caption words: a THIN SPACE (U+2009). Thai-to-Thai boundaries omit it.
 * Layout and rendering must both use `wordGap` to select the separator.
 */
export const WORD_GAP = ' ';

/** Inspect only the boundary characters, including Thai combining marks, without allocating substrings. */
export function wordGap(left: string, right: string): string {
  const end = left.charCodeAt(left.length - 1);
  const start = right.charCodeAt(0);
  return end >= 0x0e00 && end <= 0x0e7f && start >= 0x0e00 && start <= 0x0e7f ? '' : WORD_GAP;
}

/** The exact string the stage draws for a line, with the same boundary separators as its word spans. */
export function lineText(words: readonly TimedWord[], line: readonly number[]): string {
  let text = '';
  let previous = '';
  for (let k = 0; k < line.length; k++) {
    const current = words[line[k] as number]?.text ?? '';
    if (k > 0) text += wordGap(previous, current);
    text += current;
    previous = current;
  }
  return text;
}

/**
 * Greedy fill: returns lines as word indexes. Each candidate line is measured as the exact string the stage draws
 * (words + spaces), so layout and rendering cannot disagree. A word wider than `maxWidth` gets a line of its own.
 */
export function layoutLines(words: readonly TimedWord[], measure: Measure, maxWidth: number): number[][] {
  const lines: number[][] = [];
  let line: number[] = [];
  words.forEach((_w, i) => {
    if (line.length > 0 && measure(lineText(words, [...line, i])) > maxWidth) {
      lines.push(line);
      line = [i];
    } else {
      line.push(i);
    }
  });
  if (line.length) lines.push(line);
  return lines;
}

export type BuildOptions = {
  measure: Measure;
  /** Line width in canvas pixels (e.g. 864 for 1080-wide with 108 px safe margins). */
  maxWidth: number;
  maxLines: number;
  /** A silence at least this long starts a new caption page. */
  pauseFrames: number;
};

/**
 * Transcript words (project frames) → caption pages: glue, split at pauses, fill lines, cut into pages of at most
 * `maxLines`. Word frames inside each page are relative to the page start (Project JSON caption element).
 */
export function buildCaptions(input: readonly TimedWord[], opts: BuildOptions): CaptionPage[] {
  const words = glueWords(input);
  const runs: TimedWord[][] = [];
  for (const w of words) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (!run || !last || w.startFrame - last.endFrame >= opts.pauseFrames) runs.push([w]);
    else run.push(w);
  }
  const pages: CaptionPage[] = [];
  for (const run of runs) {
    const lines = layoutLines(run, opts.measure, opts.maxWidth);
    for (let i = 0; i < lines.length; i += opts.maxLines) {
      const chunk = lines.slice(i, i + opts.maxLines);
      const idx = chunk.flat();
      const ws = idx.map((k) => run[k] as TimedWord);
      const first = ws[0] as TimedWord;
      const last = ws[ws.length - 1] as TimedWord;
      const start = first.startFrame;
      const base = idx[0] ?? 0;
      pages.push({
        startFrame: start,
        durationFrames: Math.max(1, last.endFrame - start),
        words: ws.map((w) => ({
          text: w.text,
          startFrame: w.startFrame - start,
          endFrame: w.endFrame - start,
        })),
        lines: chunk.map((l) => l.map((k) => k - base)),
      });
    }
  }
  return pages;
}

/**
 * Loads every unicode-range subset of the caption font that captions use. `document.fonts.load(font)` alone only
 * loads the subset for its default sample text (a space) → Thai would be measured with a fallback font.
 */
export async function loadCaptionFont(font: string): Promise<void> {
  await document.fonts.load(font, 'กขฃคฅ ก่ก้ก๊ก๋ ฿%0123456789 AaBb');
}

/** Canvas text measure for the bundled caption font (browser only; call `loadCaptionFont` first). */
export function canvasMeasure(font: string): Measure {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('canvas 2d not available');
  ctx.font = font;
  return (text) => ctx.measureText(text).width;
}
