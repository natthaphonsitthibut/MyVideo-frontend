import { useQuery } from '@tanstack/react-query';
import { memo, useEffect, useRef } from 'react';
import { assetUrl, spriteSheetUrl, useSource } from '@/api/sources';
import { spriteCell } from '@/features/library/sprite';

type PeaksLevel = { bucketsPerSecond: number; min: number[]; max: number[] };
type Peaks = { durationMs: number; levels: PeaksLevel[] };

/** Peaks JSON of a source (cached forever: derived data never changes for a recipe). */
function usePeaks(sourceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['peaks', sourceId],
    enabled: Boolean(sourceId) && enabled,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
      (await (
        await fetch(assetUrl(sourceId as string, 'peaks'), { credentials: 'same-origin' })
      ).json()) as Peaks,
  });
}

const sheets = new Map<string, HTMLImageElement>();
function sheet(url: string): HTMLImageElement {
  let img = sheets.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    sheets.set(url, img);
  }
  return img;
}

/**
 * Filmstrip (sprites) + waveform (peaks) of one media clip, drawn into a canvas at `widthPx` (the clip width at the
 * zoom the drawing was made for). During a live zoom the canvas is only stretched by CSS; it is redrawn when the
 * zoom settles (`widthPx` changes). Only clips inside the visible range are mounted at all.
 */
export const ClipVisual = memo(function ClipVisual({
  sourceId,
  fromSec,
  toSec,
  widthPx,
  filmstrip,
}: {
  sourceId: string | undefined;
  fromSec: number;
  toSec: number;
  widthPx: number;
  filmstrip: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const source = useSource(sourceId ?? '');
  const peaks = usePeaks(sourceId, Boolean(source.data?.hasPeaks));
  const sprites = source.data?.sprites ?? null;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || widthPx < 2) return;
    const w = Math.min(4096, Math.round(widthPx));
    const h = 40;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (filmstrip && sprites && sourceId) {
        const tileW = Math.max(24, (h * sprites.tileWidth) / sprites.tileHeight);
        for (let x = 0; x < w; x += tileW) {
          const t = fromSec + ((toSec - fromSec) * (x + tileW / 2)) / w;
          const c = spriteCell(sprites, t);
          const img = sheet(spriteSheetUrl(sourceId, c.sheet));
          if (img.complete && img.naturalWidth)
            ctx.drawImage(img, c.x, c.y, sprites.tileWidth, sprites.tileHeight, x, 0, tileW, h);
          else img.addEventListener('load', draw, { once: true });
        }
      }
      const p = peaks.data;
      if (p?.levels.length) {
        const span = toSec - fromSec;
        const level =
          [...p.levels]
            .sort((a, b) => a.bucketsPerSecond - b.bucketsPerSecond)
            .find((l) => l.bucketsPerSecond * span >= w) ?? p.levels[p.levels.length - 1];
        if (!level) return;
        ctx.fillStyle = filmstrip ? 'rgba(255,255,255,0.8)' : getComputedStyle(canvas).color;
        for (let x = 0; x < w; x++) {
          const a = Math.floor((fromSec + (span * x) / w) * level.bucketsPerSecond);
          const b = Math.max(a + 1, Math.floor((fromSec + (span * (x + 1)) / w) * level.bucketsPerSecond));
          let hi = 0;
          for (let i = a; i < b && i < level.max.length; i++)
            hi = Math.max(hi, Math.abs(level.max[i] ?? 0), Math.abs(level.min[i] ?? 0));
          const bar = Math.max(1, (hi / 127) * (filmstrip ? 10 : h - 4));
          ctx.fillRect(x, filmstrip ? h - bar : (h - bar) / 2, 1, bar);
        }
      }
    };
    draw();
    return () => {
      cancelled = true;
    };
  }, [widthPx, fromSec, toSec, filmstrip, sprites, sourceId, peaks.data]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full text-primary"
      aria-hidden
    />
  );
});
