import type { StageProject } from '@myvideo/stage';
import type { Command } from '@myvideo/timeline-core';
/** J/L cuts are explicit audio elements, so both playback and export read the same editable timing. */
export function splitAudioCut(videoId: string, kind: 'j' | 'l', id: string, trackId: string): Command {
  return {
    label: `${kind}-cut`,
    apply(draft) {
      const p = draft as unknown as StageProject,
        v = p.elements[videoId];
      if (v?.type !== 'video' || v.volume <= 0) throw new Error('เลือกช็อตที่มีเสียงและยังไม่ได้แยกเสียง');
      const asset = p.assets[v.assetId];
      if (!asset?.hasAudio) throw new Error('ช็อตนี้ไม่มีเสียง');
      const fps = p.fps.num / p.fps.den;
      const lead =
        kind === 'j'
          ? Math.max(
              0,
              Math.min(Math.round(0.2 * fps), v.startFrame, Math.floor(v.sourceInFrame / v.playbackRate)),
            )
          : 0;
      const tail =
        kind === 'l'
          ? Math.max(
              0,
              Math.min(
                Math.round(0.4 * fps),
                p.durationFrames - v.startFrame - v.durationFrames,
                Math.floor(
                  (asset.durationFrames - v.sourceInFrame - v.durationFrames * v.playbackRate) /
                    v.playbackRate,
                ),
              ),
            )
          : 0;
      if (lead + tail === 0) throw new Error('ขอบช็อตไม่มีพื้นที่เสียงเหลือสำหรับการเหลื่อม');
      p.tracks.push({ id: trackId, kind: 'audio', elementIds: [id] });
      p.elements[id] = {
        type: 'audio',
        id,
        trackId,
        origin: 'user',
        assetId: v.assetId,
        startFrame: v.startFrame - lead,
        durationFrames: v.durationFrames + lead + tail,
        sourceInFrame: v.sourceInFrame - Math.round(lead * v.playbackRate),
        playbackRate: v.playbackRate,
        volume: v.volume,
        fadeInFrames: Math.min(3, lead),
        fadeOutFrames: Math.min(3, tail),
      };
      v.volume = 0;
    },
  };
}
