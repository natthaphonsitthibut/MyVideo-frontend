import { expect, it } from 'vitest';
import { graphicLayers } from './graphics';
import { ENERGY_IDS, GRAPHIC_IDS, motionFrames } from './motion';
import type { StageProject } from './types';

const p: StageProject = {
  width: 1080,
  height: 1920,
  fps: { num: 30, den: 1 },
  durationFrames: 900,
  elements: {},
  tracks: [],
  assets: {
    a: { kind: 'image', sourceId: 'one', durationFrames: 900, hasAudio: false },
    b: { kind: 'image', sourceId: 'two', durationFrames: 900, hasAudio: false },
  },
};
it('compiles all components and energy levels with a full reading hold and real project assets', () => {
  for (const component of GRAPHIC_IDS)
    for (const energy of ENERGY_IDS) {
      let i = 0;
      const layers = graphicLayers(
        p,
        {
          component,
          energy,
          text: 'ราคา 80 บาท',
          evidence: { kind: component === 'live-comment' ? 'chat' : 'merchant', quote: 'ราคา 80 บาท' },
          assetId: 'a',
          afterAssetId: 'b',
          point: { x: 0.5, y: 0.5 },
        },
        0,
        () => `id-${i++}`,
      );
      for (const e of layers.elements)
        expect(
          e.durationFrames - (e.animationIn?.durationFrames ?? 0) - (e.animationOut?.durationFrames ?? 0),
        ).toBeGreaterThanOrEqual(motionFrames(energy, 1, p.fps).hold);
      expect(layers.elements.length).toBe(component === 'before-after' ? 2 : 1);
    }
});
it('rejects fabricated copy, missing image evidence and a comment without chat provenance', () => {
  const input = {
    component: 'price-tag' as const,
    energy: 'normal' as const,
    text: '199 บาท',
    evidence: { kind: 'merchant' as const, quote: '80 บาท' },
  };
  expect(() => graphicLayers(p, input, 0, () => 'id')).toThrow();
  expect(() =>
    graphicLayers(p, { ...input, component: 'before-after', assetId: 'missing' }, 0, () => 'id'),
  ).toThrow();
  expect(() => graphicLayers(p, { ...input, component: 'live-comment' }, 0, () => 'id')).toThrow();
});
