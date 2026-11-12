import type { Command } from '@myvideo/timeline-core';

/**
 * Brand kit in a clip (E08-F08). Elements point at the kit through tokens (`brand:primary|accent|text`, font
 * `brand`), never copies of its values, so a later kit change restyles the clip on its next preview/render.
 */

/** The logo asset's fixed key in a project (the stage resolves `brandLogo` to the merchant's current logo). */
export const LOGO_ASSET_ID = '00000000-0000-4000-8000-00000000b0a0';
const CTA_SECONDS = 3;

type Draft = {
  durationFrames: number;
  fps: { num: number; den: number };
  assets: Record<string, Record<string, unknown>>;
  tracks: { id: string; kind: string; elementIds: string[] }[];
  elements: Record<string, Record<string, unknown>>;
};

type Style = {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  background?: string;
  align: string;
};

/** What a named style looks like, so a text using one can be given an explicit brand style. */
const NAMED: Record<string, Style> = {
  title: { fontFamily: 'brand', fontWeight: 800, fontSize: 88, color: '', background: '', align: 'center' },
  price: { fontFamily: 'brand', fontWeight: 800, fontSize: 96, color: '', background: '', align: 'center' },
  body: { fontFamily: 'brand', fontWeight: 500, fontSize: 56, color: '', align: 'center' },
};

function branded(style: Style, ref?: string): Style {
  const { background: _bg, ...rest } = style;
  if (ref === 'price')
    return { ...rest, fontFamily: 'brand', color: 'brand:primary', background: 'brand:accent' };
  if (style.background !== undefined)
    return { ...rest, fontFamily: 'brand', color: 'brand:text', background: 'brand:primary' };
  return { ...rest, fontFamily: 'brand', color: 'brand:text' };
}

/** Every on-screen text uses the brand font and colours (labels: primary box; price tags: accent box). */
export function applyBrandToTexts(): Command {
  return {
    label: 'apply brand',
    apply(raw) {
      for (const el of Object.values((raw as unknown as Draft).elements)) {
        if (el.type !== 'text') continue;
        const ref = typeof el.styleRef === 'string' ? el.styleRef : undefined;
        const current = (el.style as Style | undefined) ?? NAMED[ref ?? ''] ?? NAMED.body;
        if (!current) continue;
        el.style = branded(current, el.style ? undefined : ref);
      }
    },
  };
}

function overlay(d: Draft, trackId: string) {
  let track = d.tracks.find((t) => t.kind === 'overlay');
  if (!track) {
    track = { id: trackId, kind: 'overlay', elementIds: [] };
    d.tracks.push(track);
  }
  return track;
}

export function hasBrandLogo(d: Draft): boolean {
  return Object.values(d.elements).some((e) => e.type === 'image' && e.assetId === LOGO_ASSET_ID);
}

/** Adds the shop logo over the whole clip (small, top right, clear of the platform's top bar) — or removes it. */
export function toggleBrandLogo(a: { id: string; trackId: string }): Command {
  return {
    label: 'logo',
    apply(raw) {
      const d = raw as unknown as Draft;
      const existing = Object.values(d.elements).filter(
        (e) => e.type === 'image' && e.assetId === LOGO_ASSET_ID,
      );
      if (existing.length > 0) {
        for (const e of existing) {
          delete d.elements[e.id as string];
          for (const t of d.tracks) t.elementIds = t.elementIds.filter((x) => x !== e.id);
        }
        delete d.assets[LOGO_ASSET_ID];
        return;
      }
      d.assets[LOGO_ASSET_ID] = {
        brandLogo: true,
        kind: 'image',
        durationFrames: d.durationFrames,
        hasAudio: false,
      };
      const track = overlay(d, a.trackId);
      track.elementIds.push(a.id);
      d.elements[a.id] = {
        type: 'image',
        id: a.id,
        trackId: track.id,
        startFrame: 0,
        durationFrames: d.durationFrames,
        origin: 'user',
        assetId: LOGO_ASSET_ID,
        fit: 'contain',
        // the full-frame box scaled to 16 % (≈ 170 px wide), centred at (+380, −700) from the frame centre
        transform: { x: 380, y: -700, scale: 0.16, rotation: 0 },
      };
    },
  };
}

/** The shop's own call-to-action (brand kit `defaultCta`) as a label over the clip's last 3 seconds. */
export function addBrandCta(a: { id: string; trackId: string; label: string }): Command {
  return {
    label: 'brand cta',
    apply(raw) {
      const d = raw as unknown as Draft;
      const len = Math.min(d.durationFrames, Math.round((CTA_SECONDS * d.fps.num) / d.fps.den));
      const track = overlay(d, a.trackId);
      track.elementIds.push(a.id);
      d.elements[a.id] = {
        type: 'text',
        id: a.id,
        trackId: track.id,
        startFrame: d.durationFrames - len,
        durationFrames: len,
        origin: 'user',
        content: a.label,
        style: {
          fontFamily: 'brand',
          fontWeight: 800,
          fontSize: 72,
          color: 'brand:primary',
          background: 'brand:accent',
          align: 'center',
        },
        transform: { x: 0, y: 520, scale: 1, rotation: 0 },
        animationIn: { presetId: 'pop', durationFrames: 9 },
      };
    },
  };
}
