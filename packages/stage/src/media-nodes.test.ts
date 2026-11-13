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

it('showcase images share one source for the blurred backdrop and contained product card', () => {
  const p = project();
  p.elements = {
    photo: {
      type: 'image',
      id: 'photo',
      trackId: 't',
      assetId: 'a',
      startFrame: 0,
      durationFrames: 60,
      origin: 'ai',
      fit: 'contain',
      presentation: 'showcase',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    },
  };
  p.assets.a = { sourceId: 'photo-source', kind: 'image', durationFrames: 60, hasAudio: false };
  p.tracks = [{ id: 't', kind: 'video', elementIds: ['photo'] }];
  const stage = mountStage(document.createElement('div'), p, () => '/photo.jpg');
  stage.draw(0);
  const images = [...stage.root.querySelectorAll('img')];
  expect(images).toHaveLength(2);
  expect(images.map((i) => i.getAttribute('src'))).toEqual(['/photo.jpg', '/photo.jpg']);
  expect(images[0]?.style.objectFit).toBe('cover');
  expect(images[0]?.style.filter).toContain('blur');
  expect(images[1]?.style.objectFit).toBe('contain');
  expect(stage.root.querySelectorAll('video')).toHaveLength(0);
  stage.destroy();
});

it('jump cuts alternate between two decoders (A/B lanes); rational source time without DOM state', () => {
  const p = project();
  p.fps = { num: 30000, den: 1001 };
  const groups = videoGroups(p);
  // every cut in the fixture jumps in the source → lanes A (even shots) and B (odd shots)
  expect(groups.map((g) => [g.id, g.elementIds.length])).toEqual([
    ['v0', 13],
    ['v1', 12],
  ]);
  for (const [frame, id, time, lane] of [
    [30, 'v1', 2.002, 'v1'],
    [0, 'v0', 0, 'v0'],
    [31, 'v1', 2.035366666666667, 'v1'],
    [720, 'v24', 48.048, 'v0'],
  ] as const) {
    const visible = frameState(p, frame).visible[0]!;
    expect(visible.id).toBe(id);
    expect(visible.mediaTime).toBeCloseTo(time, 9);
    expect(groups.find((g) => g.elementIds.includes(id))?.id).toBe(lane);
  }
  // a continuous take (no source jump) stays on one decoder
  const take = project();
  for (let i = 0; i < 25; i++)
    take.elements[`v${i}`] = { ...take.elements[`v${i}`]!, sourceInFrame: i * 30 } as StageElement;
  expect(videoGroups(take)).toHaveLength(1);
  // another asset in the middle starts new lanes
  p.elements.v1 = { ...p.elements.v1!, assetId: 'b' } as StageElement;
  expect(videoGroups(p).map((g) => g.elementIds.length)).toEqual([1, 1, 12, 11]);
});

it('the hidden lane waits at the start of its next shot, so a jump cut plays without a seek', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  const videos = [...stage.root.querySelectorAll('video')];
  expect(videos).toHaveLength(2);
  const [a] = stage.draw(10);
  // lane B is parked at v1's first source frame (aimed a quarter frame in, like a seek) while A plays v0
  const b = videos.find((v) => v !== a?.el)!;
  expect(b.currentTime).toBeCloseTo(2 + 1 / 120, 6);
  // at the cut B shows v1 with no further seek
  let seeks = 0;
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;
  Object.defineProperty(b, 'currentTime', {
    get: () => desc.get!.call(b),
    set: (v: number) => {
      seeks++;
      desc.set!.call(b, v);
    },
  });
  expect(stage.draw(30)[0]?.el).toBe(b);
  expect(seeks).toBe(0);
  stage.destroy();
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

it('a seek onto a shot whose decoder was parked while hidden still waits for a presented frame', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  const a = stage.draw(10)[0]!.el;
  const b = [...stage.root.querySelectorAll('video')].find((v) => v !== a)!;
  // jsdom: pretend the park seek finished and the decoder has data, so only the "presented" wait remains
  Object.defineProperty(b, 'readyState', { value: 4 });
  let presented: VideoFrameRequestCallback | undefined;
  b.requestVideoFrameCallback = (callback) => {
    presented = callback;
    return 1;
  };
  let done = false;
  const pending = stage.seek(30).then(() => {
    done = true;
  });
  b.dispatchEvent(new Event('seeked'));
  await Promise.resolve();
  expect(done).toBe(false); // its time already matched, but the picture on screen is still an old one
  presented!(0, { mediaTime: 2 } as VideoFrameCallbackMetadata);
  await pending;
  expect(done).toBe(true);
  stage.destroy();
});

it('uses two decoders for 25 consecutive jump cuts, with exact source times and per-cut transforms', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const stage = mountStage(document.createElement('div'), project(), () => '/video.mp4');
  expect(stage.root.querySelectorAll('video')).toHaveLength(2);
  const laneA = stage.draw(29)[0]!.el;
  const cut = stage.draw(30)[0]!;
  expect(cut.el).not.toBe(laneA);
  expect(cut.time).toBe(2);
  expect(cut.el.closest('[data-el]')?.getAttribute('data-el')).toBe('v1');
  expect((cut.el.closest('[data-el]') as HTMLElement).style.transform).toContain('scale(1.12)');
  expect(stage.draw(0)[0]).toEqual({ el: laneA, time: 0 });
  expect(laneA.currentTime).toBe(0);
  expect(stage.draw(749)[0]).toEqual({ el: laneA, time: 48 + 29 / 30 });
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
  expect(stage.root.querySelectorAll('video')).toHaveLength(3); // A/B lanes on track t + the other track
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
  const pending = stage.seek(60).then(() => {
    done = true;
  });
  // v0 → v2 share lane A (v1 played on lane B): the same decoder crosses a cut
  expect(media.currentTime).toBeCloseTo(4 + 1 / 120);
  media.dispatchEvent(new Event('seeked'));
  await Promise.resolve();
  expect(done).toBe(false);
  presented!(0, { mediaTime: 4 } as VideoFrameCallbackMetadata);
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
  const pending = stage.seek(60).then(() => {
    done = true;
  });
  media.dispatchEvent(new Event('seeked'));
  presented!(0, { mediaTime: 0 } as VideoFrameCallbackMetadata);
  await vi.advanceTimersByTimeAsync(100);
  expect(done).toBe(false);
  presented!(0, { mediaTime: 4 } as VideoFrameCallbackMetadata);
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
  const pending = stage.seek(60).then(() => {
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
