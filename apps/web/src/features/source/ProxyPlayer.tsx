import { useQuery } from '@tanstack/react-query';
import { type KeyboardEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { assetUrl, formatDuration, type SourceSummary, spriteSheetUrl } from '@/api/sources';
import { spriteStyle } from '../library/sprite';

type PeaksLevel = { bucketsPerSecond: number; min: number[]; max: number[] };
type Peaks = { durationMs: number; levels: PeaksLevel[]; silent: boolean; hasAudio: boolean };

const STRIP_H = 56;
const WAVE_H = 48;

function usePeaks(source: SourceSummary) {
  return useQuery({
    queryKey: ['peaks', source.id],
    enabled: source.hasPeaks,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
      (await (await fetch(assetUrl(source.id, 'peaks'), { credentials: 'same-origin' })).json()) as Peaks,
  });
}

/** Draws min/max bars for `width` px, picking the coarsest level that still has ≥ 1 bucket per pixel. */
function drawWave(canvas: HTMLCanvasElement, peaks: Peaks, width: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(WAVE_H * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, WAVE_H);
  const levels = [...peaks.levels].sort((a, b) => a.bucketsPerSecond - b.bucketsPerSecond);
  const level = levels.find((l) => l.max.length >= width) ?? levels[levels.length - 1];
  if (!level) return;
  const mid = WAVE_H / 2;
  ctx.fillStyle = getComputedStyle(canvas).color;
  const n = level.max.length;
  for (let x = 0; x < width; x++) {
    const a = Math.floor((x / width) * n);
    const b = Math.max(a + 1, Math.floor(((x + 1) / width) * n));
    let lo = 0;
    let hi = 0;
    for (let i = a; i < b && i < n; i++) {
      lo = Math.min(lo, level.min[i] ?? 0);
      hi = Math.max(hi, level.max[i] ?? 0);
    }
    const top = mid - (hi / 127) * mid;
    const h = Math.max(1, ((hi - lo) / 127) * mid);
    ctx.fillRect(x, top, 1, h);
  }
}

/**
 * Proxy player for a source (editor-performance rules): the playhead, scrub preview and seeks are written
 * straight to the DOM from refs and one rAF loop; React does not re-render per frame or per pointer move.
 */
export function ProxyPlayer({ source }: { source: SourceSummary }) {
  const duration = (source.durationMs ?? 0) / 1000;
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const hoverTimeRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const peaks = usePeaks(source);
  const idx = source.sprites;
  const sheet = (n: number) => spriteSheetUrl(source.id, n);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (waveRef.current && peaks.data && width) drawWave(waveRef.current, peaks.data, width);
  }, [peaks.data, width]);

  // single rAF loop: playhead + timecode
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && playheadRef.current && width && duration) {
        playheadRef.current.style.transform = `translateX(${(v.currentTime / duration) * width}px)`;
        if (timeRef.current)
          timeRef.current.textContent = `${formatDuration(v.currentTime * 1000)} / ${formatDuration(duration * 1000)}`;
        trackRef.current?.setAttribute('aria-valuenow', String(Math.round(v.currentTime)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, duration]);

  // scrub: "latest seek wins" — never queue a seek per pointer event
  const scrub = useRef({
    active: false,
    rectLeft: 0,
    rectWidth: 1,
    seeking: false,
    pending: null as number | null,
  });
  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const s = scrub.current;
    if (s.seeking) {
      s.pending = t;
      return;
    }
    s.seeking = true;
    v.currentTime = t;
  };
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onSeeked = () => {
      const s = scrub.current;
      s.seeking = false;
      if (s.pending !== null) {
        const t = s.pending;
        s.pending = null;
        seek(t);
      }
    };
    v.addEventListener('seeked', onSeeked);
    return () => v.removeEventListener('seeked', onSeeked);
  });

  const timeAt = (clientX: number) => {
    const s = scrub.current;
    return Math.max(0, Math.min(duration, ((clientX - s.rectLeft) / s.rectWidth) * duration));
  };
  const showHover = (t: number) => {
    const h = hoverRef.current;
    if (!h || !idx) return;
    const tileW = Math.round((STRIP_H * 1.6 * idx.tileWidth) / idx.tileHeight);
    Object.assign(h.style, spriteStyle(sheet, idx, t, tileW), {
      width: `${tileW}px`,
      height: `${Math.round((tileW * idx.tileHeight) / idx.tileWidth)}px`,
      transform: `translateX(${Math.max(0, Math.min(width - tileW, (t / duration) * width - tileW / 2))}px)`,
      opacity: '1',
    });
    if (hoverTimeRef.current) hoverTimeRef.current.textContent = formatDuration(t * 1000);
  };
  const measure = () => {
    const r = trackRef.current?.getBoundingClientRect(); // once per gesture, never inside move
    if (r) Object.assign(scrub.current, { rectLeft: r.left, rectWidth: r.width });
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    measure();
    scrub.current.active = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    videoRef.current?.pause();
    const t = timeAt(e.clientX);
    showHover(t);
    seek(t);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!scrub.current.active && e.pointerType === 'mouse' && e.buttons === 0) {
      if (scrub.current.rectWidth <= 1) measure();
    }
    const t = timeAt(e.clientX);
    showHover(t);
    if (scrub.current.active) seek(t);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!scrub.current.active) return;
    scrub.current.active = false;
    seek(timeAt(e.clientX));
  };
  const onLeave = () => {
    if (hoverRef.current) hoverRef.current.style.opacity = '0';
  };
  const onKey = (e: KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowRight') v.currentTime = Math.min(duration, v.currentTime + step);
    else if (e.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - step);
    else if (e.key === ' ') void (v.paused ? v.play() : v.pause());
    else return;
    e.preventDefault();
  };

  const tiles =
    idx && width ? Math.max(1, Math.ceil(width / ((STRIP_H * idx.tileWidth) / idx.tileHeight))) : 0;
  const tileW = tiles ? width / tiles : 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-center overflow-hidden rounded-xl bg-black">
        {/* biome-ignore lint/a11y/useMediaCaption: merchant footage has no caption track yet (captions come with transcripts in E04) */}
        <video
          ref={videoRef}
          src={assetUrl(source.id, 'proxy')}
          controls
          playsInline
          preload="auto"
          className="max-h-[60vh] w-auto max-w-full"
          data-testid="proxy-video"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span ref={timeRef}>0:00 / {formatDuration(source.durationMs)}</span>
        <span>ลากบนแถบภาพเพื่อเลื่อนดู · ← → เลื่อนทีละวินาที</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="เลื่อนดูวิดีโอ"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onLeave}
        onKeyDown={onKey}
        className="relative touch-none rounded-lg border bg-muted outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        data-testid="scrub-track"
      >
        <div className="flex overflow-hidden rounded-t-lg" style={{ height: STRIP_H }} aria-hidden>
          {idx
            ? Array.from({ length: tiles }, (_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: tiles are positional
                  key={i}
                  className="shrink-0"
                  style={{
                    width: tileW,
                    height: STRIP_H,
                    ...spriteStyle(sheet, idx, ((i + 0.5) / tiles) * duration, tileW),
                  }}
                />
              ))
            : null}
        </div>
        <canvas
          ref={waveRef}
          className="block text-primary/60"
          style={{ width: '100%', height: WAVE_H }}
          aria-hidden
        />
        <div
          ref={playheadRef}
          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-destructive"
          aria-hidden
        />
        <div
          ref={hoverRef}
          className="pointer-events-none absolute bottom-full left-0 mb-2 rounded-md border-2 border-white opacity-0 shadow-lg"
          aria-hidden
        >
          <span
            ref={hoverTimeRef}
            className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] text-white"
          />
        </div>
      </div>
      {peaks.data && !peaks.data.hasAudio ? (
        <p className="text-xs text-muted-foreground">วิดีโอนี้ไม่มีเสียง</p>
      ) : null}
      {peaks.data?.hasAudio && peaks.data.silent ? (
        <p className="text-xs text-muted-foreground">เสียงในวิดีโอนี้เบามากหรือเงียบ</p>
      ) : null}
    </div>
  );
}
