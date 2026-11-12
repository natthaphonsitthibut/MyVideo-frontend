import { describe, expect, it } from 'vitest';
import { addTextElement, ENTRANCES, removeElement, setEntrance } from './text-elements';

const base = () => ({
  fps: { num: 30, den: 1 },
  durationFrames: 660,
  tracks: [{ id: 'v', kind: 'video', elementIds: ['vid'] }] as {
    id: string;
    kind: string;
    elementIds: string[];
  }[],
  elements: {} as Record<string, Record<string, unknown>>,
});

describe('on-screen text elements', () => {
  it('adds a text at the playhead for 3 s on an overlay track (created when missing), with an entrance', () => {
    const d = base();
    addTextElement({ id: 'new', trackId: 'ov', at: 600, text: 'สั่งได้เลยวันนี้' }).apply(d as never);
    expect(d.tracks.find((t) => t.kind === 'overlay')).toEqual({
      id: 'ov',
      kind: 'overlay',
      elementIds: ['new'],
    });
    expect(d.elements.new).toMatchObject({
      type: 'text',
      startFrame: 600,
      durationFrames: 60, // clipped at the clip end (660), not 90
      content: 'สั่งได้เลยวันนี้',
      origin: 'user',
      animationIn: { presetId: 'pop', durationFrames: 9 },
    });
  });

  it('removes an element from the document and its track', () => {
    const d = base();
    addTextElement({ id: 'x', trackId: 'ov', at: 0, text: 'ก' }).apply(d as never);
    removeElement('x').apply(d as never);
    expect(d.elements.x).toBeUndefined();
    expect(d.tracks.find((t) => t.kind === 'overlay')?.elementIds).toEqual([]);
  });

  it('sets an entrance from the known presets only', () => {
    const d = base();
    addTextElement({ id: 'x', trackId: 'ov', at: 0, text: 'ก' }).apply(d as never);
    setEntrance('x', 'slide-up').apply(d as never);
    expect(d.elements.x?.animationIn).toEqual({ presetId: 'slide-up', durationFrames: 9 });
    expect(() => setEntrance('x', 'explode').apply(d as never)).toThrow();
    expect(ENTRANCES.map((e) => e.id)).toContain('fade');
  });
});
