import { describe, expect, it } from 'vitest';
import { reframe, reframeRange } from './reframe';

const video = (id: string, x: number, scale: number) => ({
  type: 'video',
  id,
  assetId: 'src',
  transform: { x, y: Math.round((scale - 1) * 960 * 0.7), scale, rotation: 0 },
});

describe('reframe', () => {
  it('range: how far a cover-cropped source can move sideways', () => {
    // 16:9 landscape source in a 1080×1920 frame: drawn 3413 px wide → ±1166 px
    expect(reframeRange({ width: 1920, height: 1080 }, 1080, 1920)).toBe(1166);
    // the real S01a source is already portrait (406×720, a hair wider than 9:16): 1 px to move
    expect(reframeRange({ width: 406, height: 720 }, 1080, 1920)).toBe(1);
    // unknown size → a safe default
    expect(reframeRange(undefined, 1080, 1920)).toBe(540);
  });

  it('moves every shot of the clip sideways by the same offset; zoom and height stay per shot', () => {
    const doc = { elements: { a: video('a', 0, 1), b: video('b', 0, 1.2), t: { type: 'text', id: 't' } } };
    const draft = structuredClone(doc) as unknown as Parameters<ReturnType<typeof reframe>['apply']>[0];
    reframe(-300, 1166).apply(draft);
    const els = draft.elements as unknown as typeof doc.elements;
    expect(els.a.transform).toEqual({ x: -300, y: 0, scale: 1, rotation: 0 });
    expect(els.b.transform).toEqual({ x: -300, y: video('b', 0, 1.2).transform.y, scale: 1.2, rotation: 0 });
    // clamped to the range
    reframe(5000, 1166).apply(draft);
    expect((draft.elements as unknown as typeof doc.elements).a.transform.x).toBe(1166);
  });
});
