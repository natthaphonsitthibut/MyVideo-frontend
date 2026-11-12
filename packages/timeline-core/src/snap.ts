import type { TimelineDoc } from './types';

/**
 * Snap targets as a sorted, de-duplicated typed array: project start/end, every element start and end, plus
 * extra points (playhead, markers). Built once per gesture (pointerdown), queried on every pointermove.
 */
export function buildEdges(doc: TimelineDoc, opts: { exclude?: string; extra?: number[] } = {}): Int32Array {
  const set = new Set<number>([0, doc.durationFrames, ...(opts.extra ?? [])]);
  for (const e of Object.values(doc.elements)) {
    if (e.id === opts.exclude) continue;
    set.add(e.startFrame);
    set.add(e.startFrame + e.durationFrames);
  }
  return Int32Array.from([...set].sort((a, b) => a - b));
}

/** Nearest edge within `threshold` frames (binary search, no allocation); ties prefer the earlier edge. */
export function snapFrame(
  frame: number,
  edges: Int32Array,
  threshold: number,
): { frame: number; snapped: boolean } {
  let lo = 0;
  let hi = edges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((edges[mid] ?? 0) < frame) lo = mid + 1;
    else hi = mid - 1;
  }
  // edges[hi] < frame <= edges[lo]
  let best = -1;
  let dist = Number.POSITIVE_INFINITY;
  for (const i of [hi, lo]) {
    const e = edges[i];
    if (e === undefined) continue;
    const d = Math.abs(e - frame);
    if (d < dist) {
      dist = d;
      best = e;
    }
  }
  return best >= 0 && dist <= threshold ? { frame: best, snapped: true } : { frame, snapped: false };
}
