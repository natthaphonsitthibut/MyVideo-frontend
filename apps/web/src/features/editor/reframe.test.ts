import { describe, expect, it } from 'vitest';
import { currentZoom, reframe, reframeRange, shotScales, zoomShots } from './reframe';

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

  it('zoom multiplies every shot by the same factor over its AI zoom (punch-ins stay relative), 1×–2×', () => {
    const doc = { elements: { a: video('a', 0, 1), b: video('b', 0, 1.2) } };
    const base = shotScales(doc.elements as never);
    expect(base).toEqual({ a: 1, b: 1.2 });
    const draft = structuredClone(doc) as unknown as Parameters<ReturnType<typeof zoomShots>['apply']>[0];
    zoomShots(1.5, base).apply(draft);
    const els = draft.elements as unknown as typeof doc.elements;
    expect(els.a.transform.scale).toBe(1.5);
    expect(els.b.transform.scale).toBeCloseTo(1.8);
    expect(currentZoom(els as never, base)).toBeCloseTo(1.5);
    zoomShots(9, base).apply(draft);
    expect((draft.elements as unknown as typeof doc.elements).a.transform.scale).toBe(2);
    zoomShots(1, base).apply(draft);
    expect((draft.elements as unknown as typeof doc.elements).b.transform.scale).toBe(1.2);
  });

  it('zooming in gives room to slide even a portrait source', () => {
    // real S01a portrait source: drawn 1082.7 px wide → 1 px at 1×, (1082.7·1.5 − 1080)/2 = 272 px at 1.5×
    expect(reframeRange({ width: 406, height: 720 }, 1080, 1920, 1.5)).toBe(272);
  });
});
