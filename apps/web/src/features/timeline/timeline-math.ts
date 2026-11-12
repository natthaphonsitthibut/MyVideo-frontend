import { type Fps, snapFrame, type TimelineDoc } from '@myvideo/timeline-core';

/**
 * Pure geometry of the advanced timeline (E09): px ↔ frames, virtualisation range, drag/trim with snapping, track
 * under the pointer, marquee hits, ruler ticks. No DOM — the component measures once per gesture and calls these.
 */
export const TRACK_H = 56;
export const SNAP_PX = 8;

/** Frames to draw: the viewport plus one screen on each side (horizontal virtualisation). */
export function visibleRange(o: { scrollLeft: number; width: number; ppf: number; total: number }) {
  const screen = o.width / o.ppf;
  const first = o.scrollLeft / o.ppf;
  return {
    from: Math.max(0, Math.floor(first - screen)),
    to: Math.min(o.total, Math.ceil(first + 2 * screen)),
  };
}

/** New start of a dragged clip: its start OR its end snaps to the nearest edge within `SNAP_PX`. */
export function dragMove(o: {
  start: number;
  duration: number;
  dxPx: number;
  ppf: number;
  edges: Int32Array;
  total: number;
}): { start: number; snapped: number | null } {
  const raw = Math.round(o.start + o.dxPx / o.ppf);
  const threshold = SNAP_PX / o.ppf;
  const a = snapFrame(raw, o.edges, threshold);
  const b = snapFrame(raw + o.duration, o.edges, threshold);
  let start = raw;
  let snapped: number | null = null;
  const da = a.snapped ? Math.abs(a.frame - raw) : Number.POSITIVE_INFINITY;
  const db = b.snapped ? Math.abs(b.frame - (raw + o.duration)) : Number.POSITIVE_INFINITY;
  if (da <= db && a.snapped) {
    start = a.frame;
    snapped = a.frame;
  } else if (b.snapped) {
    start = b.frame - o.duration;
    snapped = b.frame;
  }
  return { start: Math.max(0, Math.min(o.total - o.duration, start)), snapped };
}

/** New start/duration while dragging a trim handle (≥ 1 frame, inside `[minStart, maxEnd]`, edge snapping). */
export function dragTrim(o: {
  side: 'start' | 'end';
  start: number;
  duration: number;
  dxPx: number;
  ppf: number;
  edges: Int32Array;
  /** Last frame the element may reach (project end or end of its source media). */
  maxEnd: number;
  /** Earliest start (0, or where its source media begins). */
  minStart: number;
}): { start: number; duration: number } {
  const threshold = SNAP_PX / o.ppf;
  const end = o.start + o.duration;
  if (o.side === 'end') {
    const raw = Math.round(end + o.dxPx / o.ppf);
    const s = snapFrame(raw, o.edges, threshold).frame;
    const e = Math.max(o.start + 1, Math.min(o.maxEnd, s));
    return { start: o.start, duration: e - o.start };
  }
  const raw = Math.round(o.start + o.dxPx / o.ppf);
  const s = snapFrame(raw, o.edges, threshold).frame;
  const st = Math.min(end - 1, Math.max(o.minStart, s));
  return { start: st, duration: end - st };
}

export function trackAt(y: number, trackCount: number): number {
  return Math.max(0, Math.min(trackCount - 1, Math.floor(y / TRACK_H)));
}

/** Element ids a marquee rectangle (content px, tracks stacked from y = 0) touches, in track then time order. */
export function marqueeHits(
  doc: TimelineDoc,
  r: { x0: number; x1: number; y0: number; y1: number },
  ppf: number,
): string[] {
  const [x0, x1] = [Math.min(r.x0, r.x1), Math.max(r.x0, r.x1)];
  const [y0, y1] = [Math.min(r.y0, r.y1), Math.max(r.y0, r.y1)];
  const out: string[] = [];
  doc.tracks.forEach((t, i) => {
    const top = i * TRACK_H;
    if (top + TRACK_H <= y0 || top >= y1) return;
    for (const id of t.elementIds) {
      const e = doc.elements[id];
      if (!e) continue;
      const l = e.startFrame * ppf;
      const rr = (e.startFrame + e.durationFrames) * ppf;
      if (rr > x0 && l < x1) out.push(id);
    }
  });
  return out;
}

/** Labelled ticks at a "nice" step so labels are ≥ 60 px apart (1 s, 2 s, 5 s, 10 s, 30 s, 1 min, …). */
export function rulerTicks(o: { from: number; to: number; ppf: number; fps: number }) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].map((s) => s * o.fps);
  const step = steps.find((s) => s * o.ppf >= 60) ?? steps[steps.length - 1] ?? o.fps;
  const major: number[] = [];
  for (let f = Math.floor(o.from / step) * step; f <= o.to; f += step) if (f >= o.from) major.push(f);
  return { step, major };
}

/** Source seconds a media clip shows (for its filmstrip and waveform). */
export function peakRange(
  e: { sourceInFrame: number; durationFrames: number; playbackRate: number },
  fps: Fps,
): { fromSec: number; toSec: number } {
  const sec = (f: number) => (f * fps.den) / fps.num;
  return { fromSec: sec(e.sourceInFrame), toSec: sec(e.sourceInFrame + e.durationFrames * e.playbackRate) };
}
