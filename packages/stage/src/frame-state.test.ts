import { describe, expect, it } from 'vitest';
import { frameState, interpolate, mediaTimeAt } from './frame-state';
import type { StageProject } from './types';

const tf = { x: 0, y: 0, scale: 1, rotation: 0 };
const NTSC = { num: 30000, den: 1001 };

function project(): StageProject {
  return {
    fps: { num: 30, den: 1 },
    width: 1080,
    height: 1920,
    durationFrames: 300,
    assets: { a: { sourceId: 's', kind: 'video', durationFrames: 81_000, hasAudio: true } },
    tracks: [
      { id: 'tv', kind: 'video', elementIds: ['v1', 'v2'] },
      { id: 'to', kind: 'overlay', elementIds: ['t1'] },
    ],
    elements: {
      v1: {
        type: 'video',
        id: 'v1',
        trackId: 'tv',
        startFrame: 0,
        durationFrames: 100,
        origin: 'ai',
        assetId: 'a',
        sourceInFrame: 21_600,
        playbackRate: 1,
        volume: 1,
        transform: tf,
        fit: 'cover',
      },
      v2: {
        type: 'video',
        id: 'v2',
        trackId: 'tv',
        startFrame: 100,
        durationFrames: 100,
        origin: 'ai',
        assetId: 'a',
        sourceInFrame: 30_000,
        playbackRate: 2,
        volume: 1,
        transform: tf,
        fit: 'cover',
      },
      t1: {
        type: 'text',
        id: 't1',
        trackId: 'to',
        startFrame: 50,
        durationFrames: 60,
        origin: 'user',
        content: 'ราคา 150 บาท',
        transform: tf,
        styleRef: 'title',
        keyframes: {
          opacity: [
            { frame: 0, value: 0, easing: 'linear' },
            { frame: 10, value: 1, easing: 'hold' },
            { frame: 50, value: 1, easing: 'linear' },
            { frame: 60, value: 0, easing: 'linear' },
          ],
        },
      },
    },
  };
}

describe('frameState: visibility per frame', () => {
  it.each([
    [0, ['v1']],
    [49, ['v1']],
    [50, ['v1', 't1']],
    [99, ['v1', 't1']],
    [100, ['v2', 't1']],
    [109, ['v2', 't1']],
    [110, ['v2']],
    [199, ['v2']],
    [200, []],
    [299, []],
  ])('frame %i → %j', (frame, visible) => {
    expect(frameState(project(), frame).visible.map((e) => e.id)).toEqual(visible);
  });

  it('draw order follows track order, then start frame', () => {
    const s = frameState(project(), 60);
    expect(s.visible.map((e) => [e.id, e.z])).toEqual([
      ['v1', 0],
      ['t1', 1],
    ]);
  });

  it('media time: source in-point + elapsed frames × rate, in seconds', () => {
    const s = frameState(project(), 130);
    expect(s.visible[0]).toMatchObject({ id: 'v2', mediaTime: (30_000 + 30 * 2) / 30 });
    expect(mediaTimeAt(project().elements.v1 as never, 0, project().fps)).toBe(720);
  });

  it('media time at 29.97 is exact rational seconds (no drift over long sources)', () => {
    const p = project();
    p.fps = NTSC;
    const v1 = p.elements.v1 as never;
    expect(mediaTimeAt(v1, 99, NTSC)).toBeCloseTo(((21_600 + 99) * 1001) / 30000, 9);
  });

  it('keyframed opacity: linear ramps, hold steps', () => {
    const at = (f: number) => frameState(project(), f).visible.find((e) => e.id === 't1')?.values.opacity;
    expect(at(50)).toBe(0);
    expect(at(55)).toBeCloseTo(0.5, 9);
    expect(at(60)).toBe(1);
    expect(at(80)).toBe(1); // hold between 10 and 50
    expect(at(105)).toBeCloseTo(0.5, 9);
  });

  it('same frame → same state, whatever was asked before (no hidden time state)', () => {
    const p = project();
    const direct = frameState(p, 77);
    for (const f of [299, 0, 150, 77, 3]) frameState(p, f);
    expect(frameState(p, 77)).toEqual(direct);
  });
});

describe('caption active word (follows word frames exactly)', () => {
  const p = project();
  p.tracks.push({ id: 'tc', kind: 'caption', elementIds: ['c1'] });
  p.elements.c1 = {
    type: 'caption',
    id: 'c1',
    trackId: 'tc',
    startFrame: 200,
    durationFrames: 60,
    origin: 'ai',
    words: [
      { text: 'อบ', startFrame: 0, endFrame: 12 },
      { text: '21.5', startFrame: 12, endFrame: 30 },
      { text: 'ยา', startFrame: 35, endFrame: 45 },
    ],
    lines: [[0, 1, 2]],
    styleRef: 'bold-highlight',
    transform: tf,
  };
  it.each([
    [200, 0],
    [211, 0],
    [212, 1], // switches on the word's first frame
    [229, 1],
    [230, -1], // pause between words
    [235, 2],
    [244, 2],
    [245, -1],
  ])('frame %i → word %i', (frame, word) => {
    expect(frameState(p, frame).visible.find((v) => v.id === 'c1')?.activeWord).toBe(word);
  });
});

describe('interpolate', () => {
  const kfs = [
    { frame: 0, value: 0, easing: 'ease-in-out' as const },
    { frame: 10, value: 100, easing: 'linear' as const },
  ];
  it('clamps before/after and eases in between', () => {
    expect(interpolate(kfs, -5)).toBe(0);
    expect(interpolate(kfs, 20)).toBe(100);
    expect(interpolate(kfs, 5)).toBeCloseTo(50, 9); // symmetric ease
    expect(interpolate(kfs, 2)).toBeLessThan(20);
  });
});
