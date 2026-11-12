import { History } from '@myvideo/timeline-core';
import { describe, expect, it } from 'vitest';
import { trimClip } from './trim';

const doc = () => ({
  schemaVersion: 1,
  fps: { num: 30, den: 1 },
  width: 1080,
  height: 1920,
  durationFrames: 300,
  assets: {},
  tracks: [
    { id: 'v', kind: 'video', elementIds: ['a', 'b'] },
    { id: 'c', kind: 'caption', elementIds: ['c1', 'c2'] },
    { id: 'o', kind: 'overlay', elementIds: ['t'] },
  ],
  elements: {
    a: {
      type: 'video',
      id: 'a',
      trackId: 'v',
      startFrame: 0,
      durationFrames: 150,
      sourceInFrame: 1000,
      playbackRate: 1,
    },
    b: {
      type: 'video',
      id: 'b',
      trackId: 'v',
      startFrame: 150,
      durationFrames: 150,
      sourceInFrame: 2000,
      playbackRate: 1,
    },
    c1: {
      type: 'caption',
      id: 'c1',
      trackId: 'c',
      startFrame: 20,
      durationFrames: 40,
      words: [
        { text: 'รับ', startFrame: 0, endFrame: 20 },
        { text: 'พิมพ์', startFrame: 20, endFrame: 40 },
      ],
      lines: [[0, 1]],
    },
    c2: {
      type: 'caption',
      id: 'c2',
      trackId: 'c',
      startFrame: 280,
      durationFrames: 20,
      words: [{ text: 'ค่ะ', startFrame: 0, endFrame: 20 }],
      lines: [[0]],
    },
    t: { type: 'text', id: 't', trackId: 'o', startFrame: 0, durationFrames: 300, content: 'hook' },
  },
});

describe('trim the whole clip', () => {
  it('keeps [in, out): media source moves with the cut, captions are cut word-wise, outside elements go', () => {
    const h = new History(doc() as never);
    h.run(trimClip(30, 270));
    const d = h.doc as unknown as ReturnType<typeof doc>;
    expect(d.durationFrames).toBe(240);
    expect(d.elements.a).toMatchObject({ startFrame: 0, durationFrames: 120, sourceInFrame: 1030 });
    expect(d.elements.b).toMatchObject({ startFrame: 120, durationFrames: 120, sourceInFrame: 2000 });
    // c1 started at 20: the first word (20–40) is cut to 30–40, still shown
    expect(d.elements.c1).toMatchObject({ startFrame: 0, durationFrames: 30 });
    expect(
      (d.elements.c1 as { words: { text: string; startFrame: number; endFrame: number }[] }).words,
    ).toEqual([
      { text: 'รับ', startFrame: 0, endFrame: 10 },
      { text: 'พิมพ์', startFrame: 10, endFrame: 30 },
    ]);
    expect(d.elements.c2).toBeUndefined();
    expect(d.tracks[1]?.elementIds).toEqual(['c1']);
    expect(d.elements.t).toMatchObject({ startFrame: 0, durationFrames: 240 });
  });

  it('undo returns the byte-equal document (canonical JSON: keys sorted, as Postgres jsonb stores them)', () => {
    const canonical = (v: unknown): string =>
      JSON.stringify(v, (_k, x) =>
        x && typeof x === 'object' && !Array.isArray(x)
          ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
          : x,
      );
    const h = new History(doc() as never);
    const before = canonical(h.doc);
    h.run(trimClip(30, 270));
    h.undo();
    expect(canonical(h.doc)).toBe(before);
  });

  it('refuses a clip shorter than 1 s', () => {
    const h = new History(doc() as never);
    expect(() => h.run(trimClip(100, 110))).toThrow();
  });
});
