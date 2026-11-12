import { describe, expect, it } from 'vitest';
import {
  addTextElement,
  aiTextOptions,
  ENTRANCES,
  openingTextId,
  removeElement,
  setEntrance,
} from './text-elements';

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

describe('AI text options', () => {
  it('lists hook, title and quote once each, skipping empty ones', () => {
    expect(aiTextOptions({ hook: 'ผ้ามัดย้อม ลายนี้มีตัวเดียว', title: 'ผ้ามัดย้อม ลายนี้มีตัวเดียว', quote: null })).toEqual(
      [{ kind: 'หัวคลิป', text: 'ผ้ามัดย้อม ลายนี้มีตัวเดียว' }],
    );
    expect(aiTextOptions({ hook: null, title: 'เสื้อวินเทจ', quote: ' ตัวนี้ อก 22 ' })).toEqual([
      { kind: 'ชื่อคลิป', text: 'เสื้อวินเทจ' },
      { kind: 'คำพูดเด่น', text: 'ตัวนี้ อก 22' },
    ]);
    expect(aiTextOptions(undefined)).toEqual([]);
  });

  it('the opening text is the earliest text in the first second', () => {
    const fps = { num: 30, den: 1 };
    expect(
      openingTextId({
        fps,
        elements: {
          v: { type: 'video', id: 'v', startFrame: 0 },
          late: { type: 'text', id: 'late', startFrame: 300 },
          hook: { type: 'text', id: 'hook', startFrame: 3 },
        },
      }),
    ).toBe('hook');
    expect(
      openingTextId({ fps, elements: { late: { type: 'text', id: 'late', startFrame: 300 } } }),
    ).toBeUndefined();
  });
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
