import { type Command, CommandError } from '@myvideo/timeline-core';

type Word = { text: string; startFrame: number; endFrame: number };
type El = {
  id: string;
  type: string;
  trackId: string;
  startFrame: number;
  durationFrames: number;
  sourceInFrame?: number;
  playbackRate?: number;
  words?: Word[];
  lines?: number[][];
};
type Draft = {
  fps: { num: number; den: number };
  durationFrames: number;
  tracks: { id: string; elementIds: string[] }[];
  elements: Record<string, El>;
};

/**
 * Simple trim (E08-F09): keep project frames [inFrame, outFrame) of the whole clip. Everything shifts so the clip
 * starts at 0; media keeps showing the same picture at the same moment; caption words are cut to what remains;
 * elements entirely outside are removed. One command, so undo restores the exact document.
 */
export function trimClip(inFrame: number, outFrame: number): Command {
  return {
    label: 'trim clip',
    apply(raw) {
      const d = raw as unknown as Draft;
      const fps = d.fps.num / d.fps.den;
      const a = Math.max(0, Math.round(inFrame));
      const b = Math.min(d.durationFrames, Math.round(outFrame));
      if (b - a < Math.round(fps)) throw new CommandError('a clip must stay at least 1 second long');
      for (const e of Object.values(d.elements)) {
        const s = Math.max(e.startFrame, a);
        const end = Math.min(e.startFrame + e.durationFrames, b);
        if (end <= s) {
          delete d.elements[e.id];
          continue;
        }
        const cutFront = s - e.startFrame;
        if (e.sourceInFrame !== undefined) e.sourceInFrame += Math.round(cutFront * (e.playbackRate ?? 1));
        if (e.words) {
          const len = end - s;
          const keep: number[] = [];
          const words: Word[] = [];
          for (const w of e.words) {
            const ws = Math.max(0, w.startFrame - cutFront);
            const we = Math.min(len, w.endFrame - cutFront);
            if (we > ws) {
              keep.push(words.length);
              words.push({ ...w, startFrame: ws, endFrame: we });
            } else keep.push(-1);
          }
          if (words.length === 0) {
            delete d.elements[e.id];
            continue;
          }
          e.words = words;
          e.lines = (e.lines ?? [])
            .map((l) => l.map((i) => keep[i] ?? -1).filter((i) => i >= 0))
            .filter((l) => l.length > 0);
        }
        e.startFrame = s - a;
        e.durationFrames = end - s;
      }
      for (const t of d.tracks) t.elementIds = t.elementIds.filter((id) => d.elements[id]);
      d.durationFrames = b - a;
    },
  };
}
