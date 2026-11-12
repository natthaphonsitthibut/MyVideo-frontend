import { addElement, type Command, CommandError, type TimelineDoc } from '@myvideo/timeline-core';

type Asset = { sourceId?: string; kind: string; durationFrames: number; hasAudio: boolean };
type Draft = TimelineDoc & { assets: Record<string, Asset> };

/**
 * Adds one of the merchant's own videos as music (its sound only, on a new audio track) or as a picture-in-picture
 * overlay (E09-F07), in ONE undoable command: asset (reused when the source is already in the project) + track +
 * element. Music starts at the playhead at half volume (duck it under speech next); never bundled music (D-026).
 */
export function addMediaFromSource(a: {
  as: 'music' | 'overlay';
  source: { id: string; durationMs: number; hasAudio: boolean };
  at: number;
  ids: { asset: string; element: string; track: string };
}): Command {
  return {
    label: a.as === 'music' ? 'add music' : 'add overlay',
    apply(raw) {
      const d = raw as Draft;
      if (a.as === 'music' && !a.source.hasAudio) throw new CommandError('this video has no sound');
      const fps = d.fps.num / d.fps.den;
      const len = Math.max(1, Math.round((a.source.durationMs / 1000) * fps));
      d.assets ??= {};
      let assetId = Object.entries(d.assets).find(([, x]) => x.sourceId === a.source.id)?.[0];
      if (!assetId) {
        assetId = a.ids.asset;
        d.assets[assetId] = {
          sourceId: a.source.id,
          kind: a.as === 'music' ? 'audio' : 'video',
          durationFrames: len,
          hasAudio: a.source.hasAudio,
        };
      }
      const kind = a.as === 'music' ? 'audio' : 'overlay';
      d.tracks.push({ id: a.ids.track, kind, elementIds: [] });
      const start = Math.max(0, Math.min(a.at, d.durationFrames - 1));
      const durationFrames = Math.min(len, d.durationFrames - start);
      const common = {
        id: a.ids.element,
        trackId: a.ids.track,
        startFrame: start,
        durationFrames,
        origin: 'user' as const,
        assetId,
        sourceInFrame: 0,
        playbackRate: 1,
      };
      addElement(
        a.as === 'music'
          ? { ...common, type: 'audio', volume: 0.5 }
          : {
              ...common,
              type: 'video',
              volume: 0,
              fit: 'cover',
              transform: { x: 300, y: -560, scale: 0.35, rotation: 0 },
            },
      ).apply(d);
    },
  };
}
