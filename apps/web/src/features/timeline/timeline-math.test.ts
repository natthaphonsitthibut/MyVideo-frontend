import { buildEdges, type TimelineDoc } from '@myvideo/timeline-core';
import { describe, expect, it } from 'vitest';
import {
  dragMove,
  dragTrim,
  marqueeHits,
  peakRange,
  rulerTicks,
  TRACK_H,
  trackAt,
  visibleRange,
} from './timeline-math';

const T = { x: 0, y: 0, scale: 1, rotation: 0 };
const v = (id: string, start: number, dur: number, track = 'v') => ({
  id,
  type: 'video' as const,
  trackId: track,
  startFrame: start,
  durationFrames: dur,
  origin: 'ai' as const,
  assetId: 'a',
  sourceInFrame: 0,
  playbackRate: 1,
  volume: 1,
  transform: T,
  fit: 'cover',
});
const doc: TimelineDoc = {
  fps: { num: 30, den: 1 },
  durationFrames: 900,
  tracks: [
    { id: 'v', kind: 'video', elementIds: ['a', 'b'] },
    { id: 'o', kind: 'overlay', elementIds: [] },
  ],
  elements: { a: v('a', 0, 120), b: v('b', 300, 90) },
};

describe('timeline math', () => {
  it('visible range covers the viewport plus one screen each side, in frames', () => {
    // 2 px per frame, scrolled 600 px, 400 px wide → frames 300..500 visible, ±200 frames margin
    expect(visibleRange({ scrollLeft: 600, width: 400, ppf: 2, total: 900 })).toEqual({ from: 100, to: 700 });
    expect(visibleRange({ scrollLeft: 0, width: 400, ppf: 2, total: 900 })).toEqual({ from: 0, to: 400 });
  });

  it('drag move snaps the start or the end to the nearest edge within 8 px', () => {
    const edges = buildEdges(doc, { exclude: 'b', extra: [450] });
    // b (90 frames) dragged so it starts at 124: its start snaps to a's end (120) — 4 frames = 8 px at 2 px/frame
    expect(dragMove({ start: 300, duration: 90, dxPx: -352, ppf: 2, edges, total: 900 })).toEqual({
      start: 120,
      snapped: 120,
    });
    // end lands near the playhead 450: start 362 → end 452 → snaps end to 450 (start 360)
    expect(dragMove({ start: 300, duration: 90, dxPx: 124, ppf: 2, edges, total: 900 })).toEqual({
      start: 360,
      snapped: 450,
    });
    // far from anything: no snap; clamped inside the project
    expect(dragMove({ start: 300, duration: 90, dxPx: 2000, ppf: 2, edges, total: 900 })).toEqual({
      start: 810,
      snapped: null,
    });
  });

  it('trim respects 1-frame minimum, the source media and neighbour snapping', () => {
    const edges = buildEdges(doc, { exclude: 'a' });
    // end of a dragged from 120 toward 300 (b's start): snaps exactly onto it
    expect(
      dragTrim({ side: 'end', start: 0, duration: 120, dxPx: 356, ppf: 2, edges, maxEnd: 900, minStart: 0 }),
    ).toEqual({ start: 0, duration: 300 });
    // the source only has 200 more frames
    expect(
      dragTrim({ side: 'end', start: 0, duration: 120, dxPx: 1000, ppf: 2, edges, maxEnd: 200, minStart: 0 }),
    ).toEqual({ start: 0, duration: 200 });
    // start trimmed past the end keeps one frame
    expect(
      dragTrim({
        side: 'start',
        start: 0,
        duration: 120,
        dxPx: 1000,
        ppf: 2,
        edges,
        maxEnd: 900,
        minStart: 0,
      }),
    ).toEqual({ start: 119, duration: 1 });
  });

  it('pointer y picks a track; marquee selects what it touches; ruler ticks fit the zoom', () => {
    expect(trackAt(5, 2)).toBe(0);
    expect(trackAt(TRACK_H + 1, 2)).toBe(1);
    expect(trackAt(TRACK_H * 5, 2)).toBe(1);
    expect(marqueeHits(doc, { x0: 0, x1: 100, y0: 0, y1: TRACK_H }, 2)).toEqual(['a']);
    expect(marqueeHits(doc, { x0: 0, x1: 700, y0: 0, y1: TRACK_H * 2 }, 2)).toEqual(['a', 'b']);
    // at 2 px/frame (30 fps) a label every second is ≥ 60 px apart
    const t = rulerTicks({ from: 0, to: 300, ppf: 2, fps: 30 });
    expect(t.major).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
    expect(rulerTicks({ from: 0, to: 9000, ppf: 0.05, fps: 30 }).major.slice(0, 2)).toEqual([0, 1800]);
  });

  it('waveform/filmstrip range: source seconds shown by a clip', () => {
    expect(
      peakRange({ sourceInFrame: 300, durationFrames: 90, playbackRate: 2 }, { num: 30, den: 1 }),
    ).toEqual({
      fromSec: 10,
      toSec: 16,
    });
  });
});
