export type MusicPlan = {
  musicId: string;
  durationMs: number;
  analysis: { bpm: number | null; firstBeatSec: number | null; beatsSec: number[]; dropsSec: number[] };
};
type Doc = {
  fps: { num: number; den: number };
  durationFrames: number;
  assets: Record<string, unknown>;
  elements: Record<string, unknown>;
  tracks: { id: string; kind: string; elementIds: string[] }[];
};
/** Ordinary persisted audio layer: a measured drop may align to a real spoken price; speech timing never moves. */
export function withMusicTrack<T extends Doc>(input: T, music: MusicPlan, id: () => string): T {
  const p = structuredClone(input),
    fps = p.fps.num / p.fps.den;
  const speech: { startFrame: number; endFrame: number }[] = [];
  let priceFrame: number | undefined;
  for (const raw of Object.values(p.elements)) {
    const e = raw as {
      type: string;
      startFrame: number;
      durationFrames: number;
      words?: { text: string; startFrame: number; endFrame: number }[];
    };
    if (e.type === 'caption')
      for (const w of e.words ?? []) {
        speech.push({ startFrame: e.startFrame + w.startFrame, endFrame: e.startFrame + w.endFrame });
        if (priceFrame === undefined && /\d.*บาท/u.test(w.text)) priceFrame = e.startFrame + w.startFrame;
      }
  }
  speech.sort((a, b) => a.startFrame - b.startFrame);
  const merged: typeof speech = [];
  for (const s of speech) {
    const prev = merged.at(-1);
    if (prev && s.startFrame - prev.endFrame < Math.round(0.1 * fps))
      prev.endFrame = Math.max(prev.endFrame, s.endFrame);
    else merged.push({ ...s });
  }
  const reveal = priceFrame ?? 0;
  const length = Math.floor((music.durationMs / 1000) * fps);
  const drop = music.analysis.dropsSec.find((t) => Math.round(t * fps) >= reveal);
  const sourceInFrame = Math.max(
    0,
    Math.min(length - 1, Math.round((drop ?? music.analysis.firstBeatSec ?? 0) * fps) - reveal),
  );
  const durationFrames = Math.min(p.durationFrames, length - sourceInFrame);
  if (durationFrames < 1) throw new Error('Music has no playable frames');
  const assetId = id(),
    elementId = id(),
    trackId = id();
  p.assets[assetId] = { musicId: music.musicId, kind: 'audio', durationFrames: length, hasAudio: true };
  p.tracks.push({
    id: trackId,
    kind: 'audio',
    elementIds: [elementId],
    music: true,
    ducking: {
      gainDb: -9,
      attackFrames: Math.round(0.2 * fps),
      releaseFrames: Math.round(0.4 * fps),
      speech: merged,
    },
  } as Doc['tracks'][number]);
  p.elements[elementId] = {
    type: 'audio',
    id: elementId,
    trackId,
    startFrame: 0,
    durationFrames,
    origin: 'ai',
    assetId,
    sourceInFrame,
    playbackRate: 1,
    volume: 0.14,
    fadeInFrames: Math.min(Math.round(0.5 * fps), Math.floor(durationFrames / 4)),
    fadeOutFrames: Math.min(Math.round(fps), Math.floor(durationFrames / 4)),
  };
  return p;
}
