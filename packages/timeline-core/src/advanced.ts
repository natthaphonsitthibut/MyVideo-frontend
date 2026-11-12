import { current } from 'immer';
import {
  assertElementPlacement as assertPlacement,
  type Command,
  CommandError,
  editableElement as editable,
  sortTrackElements as sortTrack,
  trackOf as track,
} from './commands';
import type { Easing, TimelineDoc, TimelineElement, TimelineTrack } from './types';

/**
 * Advanced timeline commands (E09): ripple edits, duplicate, speed, opacity/volume, tracks, keyframes, entrance/exit
 * presets and music ducking. Each is one undoable command; a refused edit leaves the document unchanged.
 */

type Media = Extract<TimelineElement, { sourceInFrame: number }>;
const isMedia = (e: TimelineElement): e is Media => e.type === 'video' || e.type === 'audio';

/** Elements after `e` on its track (by start), excluding e. */
function later(d: TimelineDoc, e: TimelineElement): TimelineElement[] {
  return track(d, e.trackId)
    .elementIds.map((id) => d.elements[id])
    .filter((x): x is TimelineElement => !!x && x.id !== e.id && x.startFrame >= e.startFrame + 0)
    .filter((x) => x.startFrame >= e.startFrame)
    .sort((a, b) => a.startFrame - b.startFrame);
}

function shift(d: TimelineDoc, els: TimelineElement[], delta: number) {
  // move in the order that never overlaps on the way: right-to-left when pushing right
  const order = delta > 0 ? [...els].reverse() : els;
  for (const x of order) {
    if (x.locked) throw new CommandError(`element ${x.id} is locked`);
    x.startFrame += delta;
  }
  for (const x of els) assertPlacement(d, x);
}

/** Trim the end and move every later clip on the same track by the same amount (no gap, no overlap). */
export function rippleTrimEnd(id: string, newEnd: number): Command {
  return {
    label: 'ripple trim',
    apply(d) {
      const e = editable(d, id);
      const oldEnd = e.startFrame + e.durationFrames;
      const delta = newEnd - oldEnd;
      if (newEnd - e.startFrame < 1) throw new CommandError(`element ${id} must last at least 1 frame`);
      const after = later(d, e).filter((x) => x.startFrame >= oldEnd);
      if (delta < 0) {
        e.durationFrames += delta;
        shift(d, after, delta);
      } else {
        shift(d, after, delta);
        e.durationFrames += delta;
      }
      assertPlacement(d, e);
      sortTrack(d, e.trackId);
    },
  };
}

/** Delete and close the gap on that track. */
export function rippleDelete(id: string): Command {
  return {
    label: 'ripple delete',
    apply(d) {
      const e = editable(d, id);
      const end = e.startFrame + e.durationFrames;
      const after = later(d, e).filter((x) => x.startFrame >= end);
      const t = track(d, e.trackId);
      t.elementIds = t.elementIds.filter((x) => x !== id);
      delete d.elements[id];
      shift(d, after, -e.durationFrames);
    },
  };
}

/** A copy right after the original on the same track (refused if something is there). */
export function duplicateElement(id: string, newId: string): Command {
  return {
    label: 'duplicate',
    apply(d) {
      const e = editable(d, id);
      if (d.elements[newId]) throw new CommandError(`element ${newId} already exists`);
      const copy = structuredClone(current(e)) as TimelineElement;
      copy.id = newId;
      copy.startFrame = e.startFrame + e.durationFrames;
      copy.origin = 'user';
      d.elements[newId] = copy;
      track(d, e.trackId).elementIds.push(newId);
      assertPlacement(d, copy);
      sortTrack(d, e.trackId);
    },
  };
}

/** Playback speed 0.25–4×: the same source span plays faster/slower, so the length in frames changes. */
export function setSpeed(id: string, rate: number): Command {
  return {
    label: 'speed',
    apply(d) {
      const e = editable(d, id);
      if (!isMedia(e)) throw new CommandError(`element ${id} has no speed`);
      if (!(rate >= 0.25 && rate <= 4)) throw new CommandError('speed must be between 0.25× and 4×');
      const sourceFrames = Math.round(e.durationFrames * e.playbackRate);
      e.playbackRate = rate;
      e.durationFrames = Math.max(1, Math.round(sourceFrames / rate));
      assertPlacement(d, e);
    },
  };
}

export function setOpacity(id: string, opacity: number): Command {
  return {
    label: 'opacity',
    apply(d) {
      const e = editable(d, id);
      if (e.type === 'audio') throw new CommandError('audio has no opacity');
      if (!(opacity >= 0 && opacity <= 1)) throw new CommandError('opacity must be 0–1');
      e.opacity = opacity;
    },
  };
}

export function setVolume(id: string, volume: number): Command {
  return {
    label: 'volume',
    apply(d) {
      const e = editable(d, id);
      if (!isMedia(e)) throw new CommandError(`element ${id} has no sound`);
      if (!(volume >= 0 && volume <= 2)) throw new CommandError('volume must be 0–2');
      e.volume = volume;
    },
  };
}

export function addTrack(t: { id: string; kind: TimelineTrack['kind'] }): Command {
  return {
    label: 'add track',
    apply(d) {
      if (d.tracks.some((x) => x.id === t.id)) throw new CommandError(`track ${t.id} already exists`);
      d.tracks.push({ id: t.id, kind: t.kind, elementIds: [] });
    },
  };
}

/** Moves a track to `index` (later tracks draw on top). */
export function moveTrack(id: string, index: number): Command {
  return {
    label: 'reorder tracks',
    apply(d) {
      const from = d.tracks.findIndex((t) => t.id === id);
      if (from < 0) throw new CommandError(`track ${id} not found`);
      const to = Math.max(0, Math.min(d.tracks.length - 1, index));
      const [t] = d.tracks.splice(from, 1);
      if (t) d.tracks.splice(to, 0, t);
    },
  };
}

export function setTrackFlags(id: string, flags: { locked?: boolean; muted?: boolean }): Command {
  return {
    label: 'track flags',
    apply(d) {
      const t = track(d, id);
      for (const [k, v] of Object.entries(flags) as ['locked' | 'muted', boolean | undefined][]) {
        if (v === undefined) continue;
        if (v) t[k] = true;
        else delete t[k];
      }
    },
  };
}

/** Properties the stage animates with keyframes (kept small on purpose — "the AE power", D-036). */
export const KEYFRAME_PROPS = [
  'transform.x',
  'transform.y',
  'transform.scale',
  'transform.rotation',
  'opacity',
];

export function setKeyframe(id: string, prop: string, frame: number, value: number, easing: Easing): Command {
  return {
    label: 'keyframe',
    apply(d) {
      const e = editable(d, id);
      if (!KEYFRAME_PROPS.includes(prop)) throw new CommandError(`${prop} cannot be keyframed`);
      if (e.type === 'audio') throw new CommandError('audio has no visual properties');
      if (!Number.isInteger(frame) || frame < 0 || frame >= e.durationFrames)
        throw new CommandError('keyframe must be inside the element');
      if (!Number.isFinite(value)) throw new CommandError('keyframe value must be a number');
      const all = { ...(e.keyframes ?? {}) };
      const list = (all[prop] ?? []).filter((k) => k.frame !== frame);
      list.push({ frame, value, easing });
      list.sort((a, b) => a.frame - b.frame);
      all[prop] = list;
      e.keyframes = all;
    },
  };
}

export function removeKeyframe(id: string, prop: string, frame: number): Command {
  return {
    label: 'remove keyframe',
    apply(d) {
      const e = editable(d, id);
      const list = (e.keyframes?.[prop] ?? []).filter((k) => k.frame !== frame);
      const all = { ...(e.keyframes ?? {}) };
      if (list.length) all[prop] = list;
      else delete all[prop];
      if (Object.keys(all).length) e.keyframes = all;
      else delete e.keyframes;
    },
  };
}

/** Entrance/exit presets the stage knows (`animationKeyframes`). */
export const ANIMATION_PRESETS = ['fade', 'pop', 'bounce', 'slide-up', 'zoom-in'];
const ANIMATION_FRAMES = 9;

export function setAnimation(id: string, which: 'in' | 'out', presetId: string | null): Command {
  return {
    label: which === 'in' ? 'entrance' : 'exit',
    apply(d) {
      const e = editable(d, id);
      if (e.type === 'audio') throw new CommandError('audio has no animation');
      const key = which === 'in' ? 'animationIn' : 'animationOut';
      if (presetId === null) {
        delete e[key];
        return;
      }
      if (!ANIMATION_PRESETS.includes(presetId)) throw new CommandError(`unknown preset ${presetId}`);
      e[key] = { presetId, durationFrames: Math.min(ANIMATION_FRAMES, e.durationFrames) };
    },
  };
}

/** Speech on the project timeline from caption words, gaps shorter than `mergeGap` frames joined. */
export function speechSpans(d: TimelineDoc, mergeGap = 6): [number, number][] {
  const spans: [number, number][] = [];
  for (const e of Object.values(d.elements)) {
    if (e.type !== 'caption') continue;
    for (const w of e.words) spans.push([e.startFrame + w.startFrame, e.startFrame + w.endFrame]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s[0] - last[1] <= mergeGap) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

/** −10.5 dB: music sits clearly under the seller's voice (E09-F07, D-028). */
export const DUCK_FACTOR = 0.3;

/**
 * Ducks a music element under speech: splits it at the speech edges and lowers the pieces under speech by
 * `DUCK_FACTOR`. Constant volume per piece keeps preview and render identical (both mix element volumes).
 */
export function duckUnderSpeech(id: string, speech: [number, number][], newId: () => string): Command {
  return {
    label: 'duck music',
    apply(d) {
      const e = editable(d, id);
      if (e.type !== 'audio') throw new CommandError('only an audio element can be ducked');
      const start = e.startFrame;
      const end = e.startFrame + e.durationFrames;
      const cuts = new Set<number>();
      for (const [a, b] of speech) {
        if (b <= start || a >= end) continue;
        if (a > start) cuts.add(a);
        if (b < end) cuts.add(b);
      }
      const edges = [start, ...[...cuts].sort((x, y) => x - y), end];
      const base = structuredClone(current(e));
      const t = track(d, e.trackId);
      t.elementIds = t.elementIds.filter((x) => x !== id);
      delete d.elements[id];
      for (let i = 0; i + 1 < edges.length; i++) {
        const a = edges[i] as number;
        const b = edges[i + 1] as number;
        const talking = speech.some(([s, f]) => s < b && f > a);
        const piece = {
          ...base,
          id: i === 0 ? id : newId(),
          startFrame: a,
          durationFrames: b - a,
          sourceInFrame: base.sourceInFrame + Math.round((a - start) * base.playbackRate),
          volume: talking ? Math.round(base.volume * DUCK_FACTOR * 1000) / 1000 : base.volume,
        };
        d.elements[piece.id] = piece;
        t.elementIds.push(piece.id);
        assertPlacement(d, piece);
      }
      sortTrack(d, t.id);
    },
  };
}
