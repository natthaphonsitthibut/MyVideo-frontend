/** Review queue of AI corrections (pure; user: "คำที่ AI แก้ ให้ขึ้นสัญลักษณ์ ให้ user ตรวจอีกที"). */
type Word = {
  text: string;
  aiFixed?: boolean;
  heard?: string | null;
  mergedInto?: number | null;
  needsReview?: boolean;
};
type Segment = { seq: number; words: Word[] };
export type ReviewTarget = {
  seq: number;
  index: number;
  segment: number;
  text: string;
  heard: string | null;
};

/** AI corrections still to check, in transcript order (continuations of a merged name are not separate). */
export function reviewTargets(segments: readonly Segment[]): ReviewTarget[] {
  const out: ReviewTarget[] = [];
  segments.forEach((s, segment) => {
    s.words.forEach((w, index) => {
      if (w.needsReview && (w.mergedInto ?? null) === null)
        out.push({ seq: s.seq, index, segment, text: w.text, heard: w.heard ?? null });
    });
  });
  return out;
}

export function reviewSummary(segments: readonly Segment[]): { aiFixed: number; toCheck: number } {
  let aiFixed = 0;
  let toCheck = 0;
  for (const s of segments)
    for (const w of s.words) {
      if (!w.aiFixed || (w.mergedInto ?? null) !== null) continue;
      aiFixed++;
      if (w.needsReview) toCheck++;
    }
  return { aiFixed, toCheck };
}

/** Next (+1) / previous (−1) target, wrapping; from nothing → first / last; null when the queue is empty. */
export function stepTarget(count: number, current: number | null, dir: 1 | -1): number | null {
  if (count === 0) return null;
  if (current === null || current >= count) return dir === 1 ? 0 : count - 1;
  return (current + dir + count) % count;
}
