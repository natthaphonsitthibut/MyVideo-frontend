export type TimedWord = { text: string; startMs: number; endMs: number; kind: string };
export type Segment = { seq: number; startMs: number; endMs: number; text: string; words: TimedWord[] };

/**
 * Flat, typed-array view of every word of a transcript, built once per transcript. Lets the playback loop find
 * the current word with a binary search (no allocation per frame).
 */
export type WordIndex = {
  count: number;
  starts: Int32Array;
  ends: Int32Array;
  /** Segment position (array index, not seq) of each word. */
  segOf: Int32Array;
  /** Global index of the first word of each segment position. */
  firstWord: number[];
  segStarts: Int32Array;
};

export function buildWordIndex(segments: readonly Segment[]): WordIndex {
  const count = segments.reduce((n, s) => n + s.words.length, 0);
  const starts = new Int32Array(count);
  const ends = new Int32Array(count);
  const segOf = new Int32Array(count);
  const firstWord: number[] = [];
  let i = 0;
  segments.forEach((s, si) => {
    firstWord.push(i);
    for (const w of s.words) {
      starts[i] = w.startMs;
      ends[i] = w.endMs;
      segOf[i] = si;
      i++;
    }
  });
  return {
    count,
    starts,
    ends,
    segOf,
    firstWord,
    segStarts: Int32Array.from(segments, (s) => s.startMs),
  };
}

/** Last position whose value ≤ t, or -1. */
function lastAtOrBefore(values: Int32Array, t: number): number {
  let lo = 0;
  let hi = values.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] ?? 0) <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** The word spoken at `ms` (start inclusive, end exclusive), or -1 in a pause. */
export function findWordAt(idx: WordIndex, ms: number): number {
  const i = lastAtOrBefore(idx.starts, ms);
  return i >= 0 && ms < (idx.ends[i] ?? 0) ? i : -1;
}

/** The segment at `ms`, or the last one that started before it (during pauses); first one before the start. */
export function findSegmentAt(idx: WordIndex, ms: number): number {
  if (idx.segStarts.length === 0) return -1;
  return Math.max(0, lastAtOrBefore(idx.segStarts, ms));
}

const normalise = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '');

/** Positions of segments containing `query` (spaces and case ignored — Thai has no word spaces). */
export function searchSegments(segments: readonly Segment[], query: string): number[] {
  const q = normalise(query);
  if (!q) return [];
  const out: number[] = [];
  segments.forEach((s, i) => {
    if (normalise(s.text).includes(q)) out.push(i);
  });
  return out;
}
