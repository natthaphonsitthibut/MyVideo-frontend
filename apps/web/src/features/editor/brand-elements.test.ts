import { describe, expect, it } from 'vitest';
import {
  addBrandCta,
  applyBrandToTexts,
  hasBrandLogo,
  LOGO_ASSET_ID,
  toggleBrandLogo,
} from './brand-elements';

const base = () => ({
  fps: { num: 30, den: 1 },
  durationFrames: 600,
  width: 1080,
  height: 1920,
  assets: {} as Record<string, Record<string, unknown>>,
  tracks: [{ id: 'v', kind: 'video', elementIds: ['vid'] }] as {
    id: string;
    kind: string;
    elementIds: string[];
  }[],
  elements: {
    vid: { type: 'video', id: 'vid' },
    hook: {
      type: 'text',
      id: 'hook',
      content: 'ผ้ามัดย้อม',
      style: {
        fontFamily: 'Noto Sans Thai Variable',
        fontWeight: 800,
        fontSize: 80,
        color: '#ffffff',
        background: '#e11d48',
        align: 'center',
      },
    },
    plain: {
      type: 'text',
      id: 'plain',
      content: 'ส่งฟรี',
      style: {
        fontFamily: 'Noto Sans Thai Variable',
        fontWeight: 600,
        fontSize: 60,
        color: '#fde047',
        align: 'center',
      },
    },
    named: { type: 'text', id: 'named', content: 'x', styleRef: 'title' },
  } as Record<string, Record<string, unknown>>,
});

describe('brand kit in a clip', () => {
  it('turns every text style into brand tokens (labels: primary box + text colour; bare text: text colour)', () => {
    const d = base();
    applyBrandToTexts().apply(d as never);
    expect(d.elements.hook?.style).toMatchObject({
      fontFamily: 'brand',
      color: 'brand:text',
      background: 'brand:primary',
      fontWeight: 800,
      fontSize: 80,
    });
    expect(d.elements.plain?.style).toMatchObject({ fontFamily: 'brand', color: 'brand:text' });
    expect((d.elements.plain?.style as Record<string, unknown> | undefined)?.background).toBeUndefined();
    // a named style gets an explicit brand style (a label, like the named title)
    expect(d.elements.named?.style).toMatchObject({ color: 'brand:text', background: 'brand:primary' });
    expect(d.elements.vid).toEqual({ type: 'video', id: 'vid' });
  });

  it('adds the logo for the whole clip (top right, small) and removes it again', () => {
    const d = base();
    toggleBrandLogo({ id: 'logo', trackId: 'ov' }).apply(d as never);
    expect(hasBrandLogo(d as never)).toBe(true);
    expect(d.assets[LOGO_ASSET_ID]).toMatchObject({ brandLogo: true, kind: 'image', durationFrames: 600 });
    expect(d.elements.logo).toMatchObject({
      type: 'image',
      assetId: LOGO_ASSET_ID,
      startFrame: 0,
      durationFrames: 600,
      fit: 'contain',
      origin: 'user',
    });
    const t = d.elements.logo?.transform as { x: number; y: number; scale: number };
    expect(t.scale).toBeLessThan(0.25);
    expect(t.x).toBeGreaterThan(0);
    expect(t.y).toBeLessThan(0);
    expect(d.tracks.find((x) => x.kind === 'overlay')?.elementIds).toContain('logo');

    toggleBrandLogo({ id: 'other', trackId: 'ov' }).apply(d as never);
    expect(hasBrandLogo(d as never)).toBe(false);
    expect(d.elements.logo).toBeUndefined();
    expect(d.assets[LOGO_ASSET_ID]).toBeUndefined();
    expect(d.tracks.find((x) => x.kind === 'overlay')?.elementIds).not.toContain('logo');
  });

  it("adds the shop's own call-to-action over the last 3 seconds in brand colours", () => {
    const d = base();
    addBrandCta({ id: 'cta', trackId: 'ov', label: 'กดตะกร้าเลย' }).apply(d as never);
    expect(d.elements.cta).toMatchObject({
      type: 'text',
      content: 'กดตะกร้าเลย',
      startFrame: 510,
      durationFrames: 90,
      style: { fontFamily: 'brand', color: 'brand:primary', background: 'brand:accent' },
    });
  });
});
