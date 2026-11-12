import type { Command } from '@myvideo/timeline-core';

/**
 * Reframe (E08-F06): an AI clip is a 9:16 `cover` crop of the source; the merchant can slide the picture sideways
 * (e.g. to keep the product in frame). One offset for every shot of the clip; each shot keeps its own zoom.
 */
export function reframeRange(
  asset: { width?: number; height?: number } | undefined,
  frameWidth: number,
  frameHeight: number,
): number {
  if (!asset?.width || !asset.height) return Math.round(frameWidth / 2);
  const drawnWidth = Math.max(frameWidth, (asset.width / asset.height) * frameHeight);
  return Math.floor((drawnWidth - frameWidth) / 2);
}

type Video = { type: 'video'; transform: { x: number; y: number; scale: number; rotation: number } };

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
