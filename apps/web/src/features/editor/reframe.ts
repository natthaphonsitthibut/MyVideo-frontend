import type { Command } from '@myvideo/timeline-core';

/**
 * Reframe (E08-F06): an AI clip is a 9:16 `cover` crop of the source; the merchant can zoom in (one factor over every
 * shot's own AI zoom, so punch-ins stay relative) and slide the picture sideways (e.g. to keep the product in frame).
 */
export const MAX_ZOOM = 2;

export function reframeRange(
  asset: { width?: number; height?: number } | undefined,
  frameWidth: number,
  frameHeight: number,
  zoom = 1,
): number {
  if (!asset?.width || !asset.height) return Math.round((frameWidth * zoom) / 2);
  const drawnWidth = Math.max(frameWidth, (asset.width / asset.height) * frameHeight) * zoom;
  return Math.floor((drawnWidth - frameWidth) / 2);
}

type Video = {
  type: 'video';
  id: string;
  transform: { x: number; y: number; scale: number; rotation: number };
};
type Elements = Record<string, { type: string }>;

export function reframe(x: number, range: number): Command {
  const clamped = Math.max(-range, Math.min(range, Math.round(x)));
  return {
    label: 'reframe',
    apply(draft) {
      for (const el of Object.values(draft.elements) as unknown as Video[]) {
        if (el.type !== 'video') continue;
        el.transform = { ...el.transform, x: clamped };
      }
    },
  };
}

/** Each shot's zoom as the clip was opened (the base the merchant's zoom multiplies). */
export function shotScales(elements: Elements): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of Object.values(elements) as unknown as Video[])
    if (e.type === 'video') out[e.id] = e.transform.scale;
  return out;
}

export function currentZoom(elements: Elements, base: Record<string, number>): number {
  for (const e of Object.values(elements) as unknown as Video[]) {
    const b = base[e.id];
    if (e.type === 'video' && b) return e.transform.scale / b;
  }
  return 1;
}

export function zoomShots(factor: number, base: Record<string, number>): Command {
  const f = Math.max(1, Math.min(MAX_ZOOM, factor));
  return {
    label: 'zoom',
    apply(draft) {
      for (const el of Object.values(draft.elements) as unknown as Video[]) {
        const b = base[el.id];
        if (el.type !== 'video' || b === undefined) continue;
        el.transform = { ...el.transform, scale: Math.round(b * f * 1000) / 1000 };
      }
    },
  };
}
