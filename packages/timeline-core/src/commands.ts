import { current } from 'immer';
import type { CaptionEl, CaptionWord, TimelineDoc, TimelineElement, TimelineTrack, Transform } from './types';

/** A refused edit (overlap, bounds, wrong element type…). The document is left unchanged. */
export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}

/** A command mutates an immer draft of the document; `History.run` turns it into patches + inverse patches. */
export type Command = { label: string; apply: (draft: TimelineDoc) => void };

const TRACK_ALLOWS: Record<TimelineTrack['kind'], readonly TimelineElement['type'][]> = {
  video: ['video', 'image'],
  audio: ['audio'],
  caption: ['caption'],
  overlay: ['text', 'image', 'shape', 'cta', 'video'],
};

function get(d: TimelineDoc, id: string): TimelineElement {
  const e = d.elements[id];
  if (!e) throw new CommandError(`element ${id} not found`);
  return e;
}

function editable(d: TimelineDoc, id: string): TimelineElement {
  const e = get(d, id);
  if (e.locked) throw new CommandError(`element ${id} is locked`);
  if (d.tracks.find((t) => t.id === e.trackId)?.locked)
    throw new CommandError(`element ${id} is on a locked track`);
  return e;
}

/** For other command modules: the element if it may be edited (exists, not locked, track not locked). */
export const editableElement = editable;
export const trackOf = track;
export const assertElementPlacement = assertPlacement;
export const sortTrackElements = sortTrack;

function track(d: TimelineDoc, id: string): TimelineTrack {
  const t = d.tracks.find((x) => x.id === id);
  if (!t) throw new CommandError(`track ${id} not found`);
  return t;
}

/** Checks one element's placement against the project and its track neighbours (after the change). */
function assertPlacement(d: TimelineDoc, e: TimelineElement) {
  const t = track(d, e.trackId);
  if (!TRACK_ALLOWS[t.kind].includes(e.type))
    throw new CommandError(`${e.type} element ${e.id} cannot sit on a ${t.kind} track`);
  if (e.durationFrames < 1) throw new CommandError(`element ${e.id} must last at least 1 frame`);
  if (e.startFrame < 0) throw new CommandError(`element ${e.id} cannot start before frame 0`);
  if (e.startFrame + e.durationFrames > d.durationFrames)
    throw new CommandError(
      `element ${e.id} would run past the end of the project (${d.durationFrames} frames)`,
    );
  if (e.type === 'video' || e.type === 'audio') {
    const asset = d.assets?.[e.assetId];
    if (asset && e.sourceInFrame + Math.round(e.durationFrames * e.playbackRate) > asset.durationFrames)
      throw new CommandError(`element ${e.id} would run past the end of its source media`);
  }
  for (const otherId of t.elementIds) {
    if (otherId === e.id) continue;
    const o = d.elements[otherId];
    if (o && e.startFrame < o.startFrame + o.durationFrames && o.startFrame < e.startFrame + e.durationFrames)
      throw new CommandError(`element ${e.id} would overlap ${o.id}`);
  }
}

/** Keeps a track's element list ordered by start frame (stable, readable patches). */
function sortTrack(d: TimelineDoc, trackId: string) {
  const t = track(d, trackId);
  t.elementIds.sort((a, b) => (d.elements[a]?.startFrame ?? 0) - (d.elements[b]?.startFrame ?? 0));
}

/** Re-maps caption line indexes after words were kept/dropped (`keep[i]` = new index or -1). */
function remapLines(lines: number[][], keep: number[]): number[][] {
  return lines.map((l) => l.map((i) => keep[i] ?? -1).filter((i) => i >= 0)).filter((l) => l.length > 0);
}

/** Shifts caption words by `-delta` frames and cuts them to `[0, length)`, dropping words left with nothing. */
function cutWords(c: CaptionEl, delta: number, length: number) {
  const keep: number[] = [];
  const words: CaptionWord[] = [];
  c.words.forEach((w) => {
    const s = Math.max(0, w.startFrame - delta);
    const e = Math.min(length, w.endFrame - delta);
    if (e > s) {
      keep.push(words.length);
      words.push({ ...w, startFrame: s, endFrame: e });
    } else keep.push(-1);
  });
  if (words.length === 0) throw new CommandError(`caption ${c.id} would have no words left`);
  c.lines = remapLines(c.lines, keep);
  c.words = words;
}

const isMedia = (e: TimelineElement): e is Extract<TimelineElement, { sourceInFrame: number }> =>
  e.type === 'video' || e.type === 'audio';

export function addElement(element: TimelineElement): Command {
  return {
    label: `add ${element.type}`,
    apply(d) {
      if (d.elements[element.id]) throw new CommandError(`element ${element.id} already exists`);
      d.elements[element.id] = structuredClone(element);
      track(d, element.trackId).elementIds.push(element.id);
      assertPlacement(d, d.elements[element.id] as TimelineElement);
      sortTrack(d, element.trackId);
    },
  };
}

export function moveElement(id: string, to: { startFrame: number; trackId?: string }): Command {
  return {
    label: 'move',
    apply(d) {
      const e = editable(d, id);
      if (to.trackId && to.trackId !== e.trackId) {
        const from = track(d, e.trackId);
        from.elementIds = from.elementIds.filter((x) => x !== id);
        track(d, to.trackId).elementIds.push(id);
        e.trackId = to.trackId;
      }
      e.startFrame = to.startFrame;
      assertPlacement(d, e);
      sortTrack(d, e.trackId);
    },
  };
}

/** Moves the element's start (its end stays); media keeps showing the same content at the same time. */
export function trimStart(id: string, newStart: number): Command {
  return {
    label: 'trim start',
    apply(d) {
      const e = editable(d, id);
      const end = e.startFrame + e.durationFrames;
      const delta = newStart - e.startFrame;
      if (newStart < 0) throw new CommandError(`element ${id} cannot start before frame 0`);
      if (newStart >= end) throw new CommandError(`element ${id} must last at least 1 frame`);
      if (isMedia(e)) {
        const src = e.sourceInFrame + Math.round(delta * e.playbackRate);
        if (src < 0) throw new CommandError(`element ${id} cannot start before its source media`);
        e.sourceInFrame = src;
      }
      if (e.type === 'caption') cutWords(e, delta, end - newStart);
      e.startFrame = newStart;
      e.durationFrames = end - newStart;
      assertPlacement(d, e);
      sortTrack(d, e.trackId);
    },
  };
}

/** Moves the element's end (exclusive frame). */
export function trimEnd(id: string, newEnd: number): Command {
  return {
    label: 'trim end',
    apply(d) {
      const e = editable(d, id);
      if (newEnd - e.startFrame < 1) throw new CommandError(`element ${id} must last at least 1 frame`);
      e.durationFrames = newEnd - e.startFrame;
      if (e.type === 'caption') cutWords(e, 0, e.durationFrames);
      assertPlacement(d, e);
    },
  };
}

/** Cuts an element in two at project frame `at`; the right part gets `newId`. */
export function split(id: string, at: number, newId: string): Command {
  return {
    label: 'split',
    apply(d) {
      const e = editable(d, id);
      const offset = at - e.startFrame;
      if (offset < 1 || offset >= e.durationFrames)
        throw new CommandError(`split frame ${at} must be inside element ${id}`);
      if (d.elements[newId]) throw new CommandError(`element ${newId} already exists`);
      const right = structuredClone(current(e)) as TimelineElement;
      right.id = newId;
      right.startFrame = at;
      right.durationFrames = e.durationFrames - offset;
      if (isMedia(right) && isMedia(e))
        right.sourceInFrame = e.sourceInFrame + Math.round(offset * e.playbackRate);
      if (right.type === 'caption' && e.type === 'caption') {
        cutWords(right, offset, right.durationFrames);
        e.durationFrames = offset;
        cutWords(e, 0, offset);
      } else {
        e.durationFrames = offset;
      }
      d.elements[newId] = right;
      track(d, e.trackId).elementIds.push(newId);
      assertPlacement(d, e);
      assertPlacement(d, right);
      sortTrack(d, e.trackId);
    },
  };
}

export function deleteElement(id: string): Command {
  return {
    label: 'delete',
    apply(d) {
      const e = editable(d, id);
      const t = track(d, e.trackId);
      t.elementIds = t.elementIds.filter((x) => x !== id);
      delete d.elements[id];
    },
  };
}

export function setText(id: string, content: string): Command {
  return {
    label: 'edit text',
    apply(d) {
      const e = editable(d, id);
      if (e.type !== 'text') throw new CommandError(`element ${id} is not a text element`);
      if (!content.trim()) throw new CommandError('text cannot be empty');
      e.content = content;
    },
  };
}

export function setTransform(id: string, transform: Transform): Command {
  return {
    label: 'transform',
    apply(d) {
      const e = editable(d, id);
      if (e.type === 'audio') throw new CommandError(`audio element ${id} has no transform`);
      e.transform = { ...transform };
    },
  };
}

/** Replaces a caption's words and stored line breaks (words relative to the caption start). */
export function setCaptionWords(id: string, words: CaptionWord[], lines: number[][]): Command {
  return {
    label: 'edit caption',
    apply(d) {
      const e = editable(d, id);
      if (e.type !== 'caption') throw new CommandError(`element ${id} is not a caption`);
      if (words.length === 0) throw new CommandError('a caption needs at least one word');
      words.forEach((w, i) => {
        if (w.endFrame <= w.startFrame || w.endFrame > e.durationFrames)
          throw new CommandError(`caption word ${i} has invalid timing`);
        const prev = words[i - 1];
        if (prev && w.startFrame < prev.endFrame)
          throw new CommandError(`caption word ${i} overlaps word ${i - 1}`);
      });
      const flat = lines.flat();
      if (flat.length !== words.length || flat.some((wi, i) => wi !== i))
        throw new CommandError('caption lines must list every word once, in order');
      e.words = words.map((w) => ({ ...w }));
      e.lines = lines.map((l) => [...l]);
    },
  };
}
