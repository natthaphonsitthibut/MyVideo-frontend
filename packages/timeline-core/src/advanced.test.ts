import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addTrack,
  duckUnderSpeech,
  duplicateElement,
  moveTrack,
  removeKeyframe,
  rippleDelete,
  rippleTrimEnd,
  setAnimation,
  setKeyframe,
  setOpacity,
  setSpeed,
  setTrackFlags,
  setVolume,
  speechSpans,
} from './advanced';
import { type Command, CommandError, moveElement } from './commands';
import type { TimelineDoc } from './types';

const T = { x: 0, y: 0, scale: 1, rotation: 0 };
const video = (id: string, start: number, dur: number, src = 0) => ({
  id,
  type: 'video' as const,
  trackId: 'v',
  startFrame: start,
  durationFrames: dur,
  origin: 'ai' as const,
  assetId: 'a',
  sourceInFrame: src,
  playbackRate: 1,
  volume: 1,
  transform: T,
  fit: 'cover',
});
function doc(): TimelineDoc {
  return {
    fps: { num: 30, den: 1 },
    durationFrames: 600,
    tracks: [
      { id: 'v', kind: 'video', elementIds: ['a', 'b', 'c'] },
      { id: 'cap', kind: 'caption', elementIds: ['cap1'] },
      { id: 'mus', kind: 'audio', elementIds: ['m'] },
    ],
    elements: {
      a: video('a', 0, 100),
      b: video('b', 100, 100, 300),
      c: video('c', 200, 100, 600),
      cap1: {
        id: 'cap1',
        type: 'caption',
        trackId: 'cap',
        startFrame: 30,
        durationFrames: 60,
        origin: 'ai',
        words: [
          { text: 'ราคา', startFrame: 0, endFrame: 20 },
          { text: '80', startFrame: 30, endFrame: 60 },
        ],
        lines: [[0, 1]],
        styleRef: 'clean',
        transform: T,
      },
      m: {
        id: 'm',
        type: 'audio',
        trackId: 'mus',
        startFrame: 0,
        durationFrames: 300,
        origin: 'user',
        assetId: 'music',
        sourceInFrame: 0,
        playbackRate: 1,
        volume: 0.8,
      },
    },
  };
}
const run = (d: TimelineDoc, c: Command) => produce(d, (x) => c.apply(x));

describe('ripple edits', () => {
  it('ripple trim end pulls later clips on the same track along (no gap); other tracks stay', () => {
    const d = run(doc(), rippleTrimEnd('a', 70));
    expect([d.elements.a, d.elements.b, d.elements.c].map((e) => [e?.startFrame, e?.durationFrames])).toEqual(
      [
        [0, 70],
        [70, 100],
        [170, 100],
      ],
    );
    expect(d.elements.cap1?.startFrame).toBe(30);
  });

  it('ripple trim end longer is refused when the source media runs out or the project ends', () => {
    // b starts at source 300 in a 1000-frame asset? lengthening a by 50 pushes c to 250..350 — fine
    const d = run(doc(), rippleTrimEnd('a', 150));
    expect(d.elements.c?.startFrame).toBe(250);
    expect(() => run(doc(), rippleTrimEnd('a', 450))).toThrow(CommandError);
  });

  it('media cannot be trimmed or slowed past the end of its source', () => {
    // c plays source frames 600–700 of a 720-frame asset: 20 more frames fit, 30 do not
    const d = { ...doc(), assets: { a: { durationFrames: 720 } } };
    expect(run(d, rippleTrimEnd('c', 320)).elements.c?.durationFrames).toBe(120);
    expect(() => run(d, rippleTrimEnd('c', 330))).toThrow(/source media/);
  });

  it('ripple delete closes the gap', () => {
    const d = run(doc(), rippleDelete('b'));
    expect(d.elements.b).toBeUndefined();
    expect(d.elements.c?.startFrame).toBe(100);
    expect(d.tracks[0]?.elementIds).toEqual(['a', 'c']);
  });
});

describe('duplicate, speed, opacity, volume', () => {
  it('duplicate goes right after the original when there is room, else refused', () => {
    const d0 = run(doc(), rippleDelete('c'));
    const d = run(d0, duplicateElement('b', 'b2'));
    expect(d.elements.b2).toMatchObject({
      startFrame: 200,
      durationFrames: 100,
      sourceInFrame: 300,
      id: 'b2',
    });
    expect(() => run(doc(), duplicateElement('a', 'a2'))).toThrow(/overlap/);
  });

  it('speed keeps the same source span: 2× = half the frames; back to 1× restores', () => {
    const d0 = run(doc(), rippleDelete('c'));
    const fast = run(d0, setSpeed('b', 2));
    expect(fast.elements.b).toMatchObject({ playbackRate: 2, durationFrames: 50, sourceInFrame: 300 });
    const back = run(fast, setSpeed('b', 1));
    expect(back.elements.b).toMatchObject({ playbackRate: 1, durationFrames: 100 });
    expect(() => run(doc(), setSpeed('a', 0.5))).toThrow(/overlap/); // 200 frames would hit b
    expect(() => run(doc(), setSpeed('a', 9))).toThrow(CommandError);
  });

  it('opacity and volume are clamped to their ranges', () => {
    expect(run(doc(), setOpacity('a', 0.4)).elements.a).toMatchObject({ opacity: 0.4 });
    expect(() => run(doc(), setOpacity('a', 1.5))).toThrow(CommandError);
    expect(run(doc(), setVolume('m', 0.25)).elements.m).toMatchObject({ volume: 0.25 });
    expect(() => run(doc(), setVolume('cap1', 1))).toThrow(CommandError);
  });
});

describe('tracks', () => {
  it('add, reorder, lock (edits refused), mute', () => {
    let d = run(doc(), addTrack({ id: 'ov', kind: 'overlay' }));
    expect(d.tracks.map((t) => t.id)).toEqual(['v', 'cap', 'mus', 'ov']);
    d = run(d, moveTrack('ov', 1));
    expect(d.tracks.map((t) => t.id)).toEqual(['v', 'ov', 'cap', 'mus']);
    d = run(d, setTrackFlags('v', { locked: true }));
    expect(() => run(d, moveElement('a', { startFrame: 5 }))).toThrow(/locked/);
    d = run(d, setTrackFlags('mus', { muted: true }));
    expect(d.tracks.find((t) => t.id === 'mus')).toMatchObject({ muted: true });
  });
});

describe('keyframes and animation presets', () => {
  it('keyframes are stored per property, sorted, relative to the element; replacing and removing work', () => {
    let d = run(doc(), setKeyframe('a', 'transform.scale', 60, 1.3, 'ease-out'));
    d = run(d, setKeyframe('a', 'transform.scale', 0, 1, 'ease-in-out'));
    d = run(d, setKeyframe('a', 'transform.scale', 60, 1.4, 'linear'));
    expect(d.elements.a?.keyframes?.['transform.scale']).toEqual([
      { frame: 0, value: 1, easing: 'ease-in-out' },
      { frame: 60, value: 1.4, easing: 'linear' },
    ]);
    expect(() => run(d, setKeyframe('a', 'transform.scale', 100, 1, 'linear'))).toThrow(CommandError); // outside
    expect(() => run(d, setKeyframe('a', 'color', 0, 1, 'linear'))).toThrow(CommandError);
    d = run(d, removeKeyframe('a', 'transform.scale', 0));
    d = run(d, removeKeyframe('a', 'transform.scale', 60));
    expect(d.elements.a?.keyframes).toBeUndefined();
  });

  it('entrance/exit presets on any visual element, never longer than the element', () => {
    const d = run(doc(), setAnimation('cap1', 'in', 'pop'));
    expect(d.elements.cap1?.animationIn).toEqual({ presetId: 'pop', durationFrames: 9 });
    const off = run(d, setAnimation('cap1', 'in', null));
    expect(off.elements.cap1?.animationIn).toBeUndefined();
    expect(() => run(doc(), setAnimation('m', 'in', 'pop'))).toThrow(CommandError);
    expect(() => run(doc(), setAnimation('a', 'out', 'spin-forever'))).toThrow(CommandError);
  });
});

describe('music ducking under speech', () => {
  it('speech spans come from caption words on the project timeline, merged across small gaps', () => {
    expect(speechSpans(doc(), 6)).toEqual([
      [30, 50],
      [60, 90],
    ]);
    expect(speechSpans(doc(), 15)).toEqual([[30, 90]]);
  });

  it('the music is split at speech edges; pieces under speech are ≥ 10 dB quieter', () => {
    const d = run(
      doc(),
      duckUnderSpeech('m', [[30, 90]], () => `p${Math.random()}`),
    );
    const pieces = Object.values(d.elements)
      .filter((e) => e.type === 'audio')
      .sort((a, b) => a.startFrame - b.startFrame);
    expect(pieces.map((p) => [p.startFrame, p.durationFrames, p.type === 'audio' ? p.volume : 0])).toEqual([
      [0, 30, 0.8],
      [30, 60, expect.closeTo(0.8 * 0.3, 5)],
      [90, 210, 0.8],
    ]);
    // 20·log10(0.3) = −10.46 dB
    expect(20 * Math.log10(0.3)).toBeLessThanOrEqual(-10);
    // source stays continuous: each piece picks up where the last ended
    expect(pieces.map((p) => (p.type === 'audio' ? p.sourceInFrame : -1))).toEqual([0, 30, 90]);
  });
});
