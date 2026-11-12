import type { StageElement, StageProject } from './types';

type Video = Extract<StageElement, { type: 'video' }>;
export type VideoGroup = { id: string; assetId: string; elementIds: string[] };

/** Consecutive intervals can use one decoder; overlaps and separate tracks cannot. */
export function videoGroups(project: StageProject): VideoGroup[] {
  const groups: VideoGroup[] = [];
  for (const track of project.tracks) {
    const videos = track.elementIds
      .map((id) => project.elements[id])
      .filter((e): e is Video => e?.type === 'video')
      .sort((a, b) => a.startFrame - b.startFrame);
    let previous: Video | undefined;
    let group: VideoGroup | undefined;
    for (const video of videos) {
      if (
        !group ||
        previous?.assetId !== video.assetId ||
        previous.startFrame + previous.durationFrames !== video.startFrame
      ) {
        group = { id: video.id, assetId: video.assetId, elementIds: [] };
        groups.push(group);
      }
      group.elementIds.push(video.id);
      previous = video;
    }
  }
  return groups;
}
