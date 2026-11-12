// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { frameState } from './frame-state';
import { mountStage } from './mount';
import type { StageElement, StageProject } from './types';
import { videoGroups } from './video-groups';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('maps arbitrary frames to one shared group and rational source time without DOM state', () => {
  const p = project();
  p.fps = { num: 30000, den: 1001 };
  const groups = videoGroups(p);
  expect(groups).toHaveLength(1);
  for (const [frame, id, time] of [
    [30, 'v1', 2.002],
    [0, 'v0', 0],
    [31, 'v1', 2.035366666666667],
    [720, 'v24', 48.048],
  ] as const) {
    const visible = frameState(p, frame).visible[0]!;
    expect(visible.id).toBe(id);
    expect(visible.mediaTime).toBeCloseTo(time, 9);
    expect(groups.find((g) => g.elementIds.includes(id))?.id).toBe('v0');
  }
  p.elements.v1 = { ...p.elements.v1!, assetId: 'b' } as StageElement;
  expect(videoGroups(p).map((g) => g.elementIds.length)).toEqual([1, 1, 23]);
});

function project(): StageProject {
  const elements: Record<string, StageElement> = {};
  for (let i = 0; i < 25; i++) {
    elements[`v${i}`] = {
      type: 'video',
      id: `v${i}`,
      trackId: 't',
      origin: 'ai',
      assetId: 'a',
      startFrame: i * 30,
      durationFrames: 30,
      sourceInFrame: i * 60,
      playbackRate: 1,
      volume: 1,
      fit: 'cover',
      transform: { x: 0, y: 0, scale: i % 2 ? 1.12 : 1, rotation: 0 },
    };
  }
  return {
    fps: { num: 30, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: 750,
    assets: { a: { sourceId: 's', kind: 'video', durationFrames: 3000, hasAudio: true } },
    tracks: [{ id: 't', kind: 'video', elementIds: Object.keys(elements).reverse() }],
    elements,
  };
}

it('uses one decoder for 25 consecutive cuts, with exact source times and per-cut transforms', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  expect(stage.root.querySelectorAll('video')).toHaveLength(1);
  const media = stage.draw(29)[0]!.el;
  expect(stage.draw(30)[0]).toEqual({ el: media, time: 2 });
  expect(media.currentTime).toBe(2);
  expect(media.closest('[data-el]')?.getAttribute('data-el')).toBe('v1');
  expect((media.closest('[data-el]') as HTMLElement).style.transform).toContain('scale(1.12)');
  expect(stage.draw(0)[0]).toEqual({ el: media, time: 0 });
  expect(media.currentTime).toBe(0);
  expect(stage.draw(749)[0]).toEqual({ el: media, time: 48 + 29 / 30 });
  expect(stage.draw(750)).toEqual([]);
  stage.destroy();
});

it('does not share across tracks or overlapping elements and regroups after a patch', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const p = project();
  p.elements.other = { ...p.elements.v0!, id: 'other', trackId: 'other' };
  p.tracks.push({ id: 'other', kind: 'video', elementIds: ['other'] });
  const stage = mountStage(document.createElement('div'), p, () => '/video.mp4');
  expect(stage.draw(0).map((m) => m.el)).toHaveLength(2);
  expect(new Set(stage.draw(0).map((m) => m.el)).size).toBe(2);
  stage.patch('v1', { ...p.elements.v1!, startFrame: 20 });
  expect(new Set(stage.draw(25).map((m) => m.el)).size).toBe(3);
  stage.patch('v1', p.elements.v1!);
  expect(stage.root.querySelectorAll('video')).toHaveLength(2);
  stage.destroy();
});

it('seek waits for decoding and presentation when crossing a shared cut', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  const media = stage.draw(0)[0]!.el as HTMLVideoElement;
  let presented: VideoFrameRequestCallback | undefined;
  media.requestVideoFrameCallback = (callback) => {
    presented = callback;
    return 1;
  };
  let done = false;
  const pending = stage.seek(30).then(() => {
    done = true;
  });
  expect(media.currentTime).toBeCloseTo(2 + 1 / 120);
  media.dispatchEvent(new Event('seeked'));
  await Promise.resolve();
  expect(done).toBe(false);
  presented!(0, { mediaTime: 2 } as VideoFrameCallbackMetadata);
  await pending;
  expect(done).toBe(true);
  stage.destroy();
  vi.unstubAllGlobals();
});

it('does not resolve a seek from an old presented frame', async () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  const media = stage.draw(0)[0]!.el as HTMLVideoElement;
  let presented: VideoFrameRequestCallback | undefined;
  media.requestVideoFrameCallback = (callback) => {
    presented = callback;
    return 1;
  };
  let done = false;
  const pending = stage.seek(30).then(() => {
    done = true;
  });
  media.dispatchEvent(new Event('seeked'));
  presented!(0, { mediaTime: 0 } as VideoFrameCallbackMetadata);
  await vi.advanceTimersByTimeAsync(100);
  expect(done).toBe(false);
  presented!(0, { mediaTime: 2 } as VideoFrameCallbackMetadata);
  await pending;
  expect(done).toBe(true);
  stage.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// D-025: a render must never hang; 1.5 s after `seeked` with no matching frame reported, the decode is trusted.
it('falls back 1.5 s after seeked when no matching frame is reported (never hangs)', async () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  const media = stage.draw(0)[0]!.el as HTMLVideoElement;
  let presented: VideoFrameRequestCallback | undefined;
  media.requestVideoFrameCallback = (callback) => {
    presented = callback;
    return 1;
  };
  let done = false;
  const pending = stage.seek(30).then(() => {
    done = true;
  });
  media.dispatchEvent(new Event('seeked'));
  await vi.advanceTimersByTimeAsync(1499);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(2);
  await pending;
  expect(done).toBe(true);
  expect(presented).toBeDefined();
  stage.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
