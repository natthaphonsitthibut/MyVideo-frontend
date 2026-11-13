// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mountStage } from './mount';
import type { StageProject } from './types';

it('applies the shared speech envelope to the audio element, including backward seeks', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const p: StageProject = {
    fps: { num: 30, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: 300,
    assets: { a: { musicId: 'm', kind: 'audio', hasAudio: true, durationFrames: 300 } },
    tracks: [
      {
        id: 't',
        kind: 'audio',
        elementIds: ['a'],
        music: true,
        ducking: {
          gainDb: -9,
          attackFrames: 6,
          releaseFrames: 12,
          speech: [{ startFrame: 30, endFrame: 60 }],
        },
      },
    ],
    elements: {
      a: {
        id: 'a',
        type: 'audio',
        trackId: 't',
        assetId: 'a',
        origin: 'user',
        startFrame: 0,
        durationFrames: 300,
        sourceInFrame: 0,
        playbackRate: 1,
        volume: 0.5,
      },
    },
  };
  const stage = mountStage(document.createElement('div'), p, () => '/music.wav');
  const audio = stage.root.querySelector('audio')!;
  stage.draw(0);
  expect(audio.volume).toBe(0.5);
  stage.draw(30);
  expect(audio.volume).toBeCloseTo(0.5 * 10 ** (-9 / 20));
  stage.draw(90);
  expect(audio.volume).toBe(0.5);
  stage.draw(30);
  expect(audio.volume).toBeCloseTo(0.5 * 10 ** (-9 / 20));
  stage.destroy();
  vi.restoreAllMocks();
});
