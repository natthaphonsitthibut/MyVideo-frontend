import { describe, expect, it } from 'vitest';
import { buildEdges, snapFrame } from './snap';
import type { TimelineDoc } from './types';

const tf = { x: 0, y: 0, scale: 1, rotation: 0 };
const d: TimelineDoc = {
  fps: { num: 30, den: 1 },
  durationFrames: 300,
  tracks: [{ id: 't', kind: 'overlay', elementIds: ['a', 'b'] }],
  elements: {
    a: {
      type: 'text',
      id: 'a',
      trackId: 't',
      startFrame: 10,
      durationFrames: 40,
      origin: 'user',
      content: 'x',
      transform: tf,
    },
    b: {
      type: 'text',
      id: 'b',
      trackId: 't',
      startFrame: 100,
      durationFrames: 20,
      origin: 'user',
      content: 'y',
      transform: tf,
    },
  },
};

describe('snapping', () => {
  it('edges: element starts/ends, project start/end, extra points (playhead); sorted, unique; excludes the dragged one', () => {
    expect(Array.from(buildEdges(d, { exclude: 'b', extra: [75, 10] }))).toEqual([0, 10, 50, 75, 300]);
  });

  it('snaps to the nearest edge within the threshold, else returns the frame', () => {
    const edges = buildEdges(d);
    expect(snapFrame(53, edges, 5)).toEqual({ frame: 50, snapped: true });
    expect(snapFrame(97, edges, 5)).toEqual({ frame: 100, snapped: true });
    expect(snapFrame(75, edges, 5)).toEqual({ frame: 75, snapped: false });
    expect(snapFrame(-3, edges, 5)).toEqual({ frame: 0, snapped: true });
    expect(snapFrame(400, edges, 5)).toEqual({ frame: 400, snapped: false });
  });

  it('ties go to the earlier edge', () => {
    expect(snapFrame(30, Int32Array.from([20, 40]), 10)).toEqual({ frame: 20, snapped: true });
  });
});
