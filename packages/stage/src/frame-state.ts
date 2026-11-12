import type { Fps } from '@myvideo/timeline-core';
import type { Keyframe, StageElement, StageProject } from './types';

export type VisibleElement = {
  id: string;
  element: StageElement;
  /** Draw order: track index (later tracks on top). */
  z: number;
  /** Frame inside the element (0 = its first frame). */
  local: number;
  /** For video/audio: where the source media must be, in seconds. */
  mediaTime?: number;
  /** Keyframed numeric properties at this frame (e.g. `opacity`, `transform.x`). */
  values: Record<string, number>;
  /** Captions: index of the word being spoken at this frame, -1 in a pause. */
  activeWord?: number;
};

export type FrameState = { frame: number; visible: VisibleElement[] };

const EASE: Record<Keyframe['easing'], (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  hold: () => 0,
};

/** Value of a keyframed property at a frame (keyframes sorted by frame; easing of the segment's first key). */
export function interpolate(kfs: readonly Keyframe[], frame: number): number {
  const first = kfs[0];
  const last = kfs[kfs.length - 1];
  if (!first || !last) return 0;
  if (frame <= first.frame) return first.value;
  if (frame >= last.frame) return last.value;
  for (let i = 1; i < kfs.length; i++) {
    const b = kfs[i] as Keyframe;
    if (frame <= b.frame) {
      const a = kfs[i - 1] as Keyframe;
      const t = (frame - a.frame) / (b.frame - a.frame);
      return a.value + (b.value - a.value) * EASE[a.easing](t);
    }
  }
  return last.value;
}

/** Source media time (s) shown at a project frame: rational, computed from integers (no accumulated drift). */
export function mediaTimeAt(
  e: Extract<StageElement, { sourceInFrame: number }>,
  frame: number,
  fps: Fps,
): number {
  const sourceFrame = e.sourceInFrame + (frame - e.startFrame) * e.playbackRate;
  return (sourceFrame * fps.den) / fps.num;
}

/**
 * Everything the stage shows at `frame`, as a pure function of (project, frame): no clock, no randomness, no DOM.
 * The DOM layer and the renderer only apply this.
 */
export function frameState(p: StageProject, frame: number): FrameState {
  const visible: VisibleElement[] = [];
  p.tracks.forEach((track, z) => {
    const els = track.elementIds
      .map((id) => p.elements[id])
      .filter(
        (e): e is StageElement => !!e && frame >= e.startFrame && frame < e.startFrame + e.durationFrames,
      )
      .sort((a, b) => a.startFrame - b.startFrame);
    for (const e of els) {
      const local = frame - e.startFrame;
      const values: Record<string, number> = {};
      for (const [prop, kfs] of Object.entries(e.keyframes ?? {})) values[prop] = interpolate(kfs, local);
      visible.push({
        id: e.id,
        element: e,
        z,
        local,
        values,
        ...('sourceInFrame' in e ? { mediaTime: mediaTimeAt(e, frame, p.fps) } : {}),
        ...(e.type === 'caption'
          ? { activeWord: e.words.findIndex((w) => local >= w.startFrame && local < w.endFrame) }
          : {}),
      });
    }
  });
  return { frame, visible };
}
