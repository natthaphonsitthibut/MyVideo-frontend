import { describe, expect, it } from 'vitest';
import { addMediaFromSource } from './add-media';

const base = () => ({
  fps: { num: 30, den: 1 },
  durationFrames: 600,
  assets: { v0: { sourceId: 's0', kind: 'video', durationFrames: 900, hasAudio: true } } as Record<
    string,
    unknown
  >,
  tracks: [{ id: 'v', kind: 'video', elementIds: [] as string[] }],
  elements: {} as Record<string, unknown>,
});

/** Commands mutate a draft; a plain clone stands in for immer here. */
function produce<T>(doc: T, f: (d: T) => void): T {
  const d = structuredClone(doc);
  f(d);
  return d;
}

describe('add media from the library', () => {
  it('music: an audio track is created, the clip starts at the playhead and stops at the project end', () => {
    const d = produce(base(), (x) =>
      addMediaFromSource({
        as: 'music',
        source: { id: 'song', durationMs: 60_000, hasAudio: true },
        at: 450,
        ids: { asset: 'a1', element: 'e1', track: 't1' },
      }).apply(x as never),
    );
    expect(d.assets.a1).toEqual({ sourceId: 'song', kind: 'audio', durationFrames: 1800, hasAudio: true });
    expect(d.tracks.at(-1)).toEqual({ id: 't1', kind: 'audio', elementIds: ['e1'] });
    expect(d.elements.e1).toMatchObject({
      type: 'audio',
      startFrame: 450,
      durationFrames: 150,
      sourceInFrame: 0,
      volume: 0.5,
      origin: 'user',
    });
  });

  it('the same source is reused as one asset; picture-in-picture goes on an overlay track, small, top right', () => {
    const d = produce(base(), (x) =>
      addMediaFromSource({
        as: 'overlay',
        source: { id: 's0', durationMs: 30_000, hasAudio: true },
        at: 0,
        ids: { asset: 'new', element: 'e2', track: 't2' },
      }).apply(x as never),
    );
    expect(Object.keys(d.assets)).toEqual(['v0']);
    expect(d.elements.e2).toMatchObject({ type: 'video', assetId: 'v0', durationFrames: 600, volume: 0 });
    expect((d.elements.e2 as { transform: { scale: number } }).transform.scale).toBeLessThan(0.5);
    expect(d.tracks.at(-1)?.kind).toBe('overlay');
  });

  it('a source without sound cannot be music', () => {
    expect(() =>
      produce(base(), (x) =>
        addMediaFromSource({
          as: 'music',
          source: { id: 'silent', durationMs: 5_000, hasAudio: false },
          at: 0,
          ids: { asset: 'a', element: 'e', track: 't' },
        }).apply(x as never),
      ),
    ).toThrow();
  });
});
