import type { StageElement, StageProject } from './types';

type Video = Extract<StageElement, { type: 'video' }>;
export type VideoGroup = { id: string; assetId: string; elementIds: string[] };

/**
 * Which video elements share one `<video>` decoder. A run = consecutive intervals of one asset on one track.
 * Inside a run, a continuous take (the source continues) stays on its decoder; a JUMP CUT (the source jumps)
 * moves to the run's other lane, so two decoders alternate (A/B): while one plays, the hidden one is parked at
 * the start of its next shot and the cut plays without a seek. Measured before (E12-F01, 2026-11-13): one shared
 * decoder froze the picture 100–150 ms at every jump cut while it seeked. Overlaps and other tracks never share.
 */
export function videoGroups(project: StageProject): VideoGroup[] {
  const groups: VideoGroup[] = [];
  for (const track of project.tracks) {
    const videos = track.elementIds
      .map((id) => project.elements[id])
      .filter((e): e is Video => e?.type === 'video')
      .sort((a, b) => a.startFrame - b.startFrame);
    let previous: Video | undefined;
    let lanes: VideoGroup[] = [];
    let lane = 0;
    for (const video of videos) {
      const sameRun =
        previous !== undefined &&
        previous.assetId === video.assetId &&
        previous.startFrame + previous.durationFrames === video.startFrame;
      if (!sameRun) {
        lanes = [];
        lane = 0;
      } else if (
        previous &&
        (previous.sourceInFrame + previous.durationFrames * previous.playbackRate !== video.sourceInFrame ||
          previous.playbackRate !== video.playbackRate)
      ) {
        lane = 1 - lane; // jump cut → the other decoder
      }
      let group = lanes[lane];
      if (!group) {
        group = { id: video.id, assetId: video.assetId, elementIds: [] };
        lanes[lane] = group;
        groups.push(group);
      }
      group.elementIds.push(video.id);
      previous = video;
    }
  }
  return groups;
}
