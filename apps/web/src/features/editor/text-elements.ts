import type { Command } from '@myvideo/timeline-core';

/** Add/remove on-screen texts and their entrance (E08-F07); every change is one undoable command. */
export const ENTRANCES: { id: string; name: string }[] = [
  { id: 'pop', name: 'เด้ง' },
  { id: 'bounce', name: 'กระดอน' },
  { id: 'slide-up', name: 'เลื่อนขึ้น' },
  { id: 'zoom-in', name: 'ซูมเข้า' },
  { id: 'fade', name: 'ค่อย ๆ ขึ้น' },
];
const ENTRANCE_FRAMES = 9;

type Draft = {
  durationFrames: number;
  fps: { num: number; den: number };
  tracks: { id: string; kind: string; elementIds: string[] }[];
  elements: Record<string, Record<string, unknown>>;
};

export function addTextElement(a: { id: string; trackId: string; at: number; text: string }): Command {
  return {
    label: 'add text',
    apply(raw) {
      const d = raw as unknown as Draft;
      const fps = d.fps.num / d.fps.den;
      const start = Math.max(0, Math.min(a.at, d.durationFrames - 1));
      let track =
        d.tracks.find((t) => t.kind === 'overlay' && t.id === a.trackId) ??
        d.tracks.find((t) => t.kind === 'overlay');
      if (!track) {
        track = { id: a.trackId, kind: 'overlay', elementIds: [] };
        d.tracks.push(track);
      }
      track.elementIds.push(a.id);
      d.elements[a.id] = {
        type: 'text',
        id: a.id,
        trackId: track.id,
        startFrame: start,
        durationFrames: Math.max(1, Math.min(Math.round(3 * fps), d.durationFrames - start)),
        origin: 'user',
        content: a.text,
        style: {
          fontFamily: 'Noto Sans Thai Variable',
          fontWeight: 800,
          fontSize: 72,
          color: '#111111',
          background: '#ffffff',
          align: 'center',
        },
        transform: { x: 0, y: -200, scale: 1, rotation: 0 },
        animationIn: { presetId: 'pop', durationFrames: ENTRANCE_FRAMES },
      };
    },
  };
}

export function removeElement(id: string): Command {
  return {
    label: 'remove element',
    apply(raw) {
      const d = raw as unknown as Draft;
      delete d.elements[id];
      for (const t of d.tracks) t.elementIds = t.elementIds.filter((x) => x !== id);
    },
  };
}

export function setEntrance(id: string, presetId: string): Command {
  if (!ENTRANCES.some((e) => e.id === presetId)) throw new Error(`unknown entrance ${presetId}`);
  return {
    label: 'entrance',
    apply(raw) {
      const el = (raw as unknown as Draft).elements[id];
      if (el) el.animationIn = { presetId, durationFrames: ENTRANCE_FRAMES };
    },
  };
}
