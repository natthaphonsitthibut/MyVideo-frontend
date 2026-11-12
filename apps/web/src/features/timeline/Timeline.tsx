import type { Player } from '@myvideo/stage';
import {
  buildEdges,
  type Command,
  CommandError,
  deleteElement,
  duplicateElement,
  formatTimecode,
  moveElement,
  moveTrack,
  rippleDelete,
  rippleTrimEnd,
  setTrackFlags,
  split,
  type TimelineDoc,
  type TimelineElement,
  trimEnd,
  trimStart,
} from '@myvideo/timeline-core';
import { ArrowDown, ArrowUp, Lock, LockOpen, Volume2, VolumeX } from 'lucide-react';
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/button';
import type { EditorStore } from '@/features/editor/editor-store';
import { ClipVisual } from './ClipVisual';
import {
  dragMove,
  dragTrim,
  marqueeHits,
  peakRange,
  rulerTicks,
  TRACK_H,
  trackAt,
  visibleRange,
} from './timeline-math';

const HEADER_W = 152;
const RULER_H = 24;
const TRACK_NAME: Record<string, string> = {
  video: 'วิดีโอ',
  audio: 'เสียง',
  caption: 'คำบรรยาย',
  overlay: 'ซ้อนภาพ',
};

type Doc = TimelineDoc & { assets?: Record<string, { durationFrames: number; sourceId?: string }> };

/** Thai message for a refused edit. */
export function refusal(err: unknown): string {
  if (!(err instanceof CommandError)) throw err;
  const m = err.message;
  if (m.includes('locked')) return 'แทร็กหรือคลิปนี้ถูกล็อกไว้';
  if (m.includes('overlap')) return 'วางทับคลิปอื่นไม่ได้';
  if (m.includes('source media')) return 'ไฟล์ต้นฉบับยาวไม่พอ';
  if (m.includes('past the end')) return 'เกินความยาวโปรเจกต์';
  if (m.includes('cannot sit')) return 'คลิปชนิดนี้ใส่แทร็กนี้ไม่ได้';
  if (m.includes('inside element')) return 'เลื่อนหัวเล่นไปไว้บนคลิปก่อนแล้วค่อยแยก';
  return 'ทำแบบนี้ไม่ได้';
}

/**
 * Advanced multi-track timeline (E09). Positions are `calc(var(--ppf) * frames)`, so zoom is one CSS variable; drags
 * and trims move DOM nodes directly and commit ONE command on release; the playhead runs on its own rAF loop;
 * only clips in the visible range (± one screen) are rendered.
 */
export function Timeline({
  store,
  playerRef,
  selected,
  onSelect,
  ripple,
  onMessage,
}: {
  store: EditorStore;
  playerRef: RefObject<Player | null>;
  selected: string[];
  onSelect: (ids: string[]) => void;
  ripple: boolean;
  onMessage: (m: string | null) => void;
}) {
  const doc = useSyncExternalStore(store.subscribe, () => store.doc() as Doc);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const ppf = useRef(2);
  const [zoomTick, setZoomTick] = useState(0);
  const [range, setRange] = useState({ from: 0, to: 2000 });
  const total = doc.durationFrames;
  const fps = doc.fps.num / doc.fps.den;

  const run = useCallback(
    (cmd: Command) => {
      try {
        store.run(cmd);
        onMessage(null);
        return true;
      } catch (err) {
        onMessage(refusal(err));
        return false;
      }
    },
    [store, onMessage],
  );

  // ruler: redrawn for the visible part only
  const drawRuler = useCallback(() => {
    const c = rulerRef.current;
    const s = scrollRef.current;
    if (!c || !s) return;
    const w = s.clientWidth - HEADER_W;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = RULER_H * dpr;
    c.style.width = `${w}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, RULER_H);
    ctx.fillStyle = getComputedStyle(c).color;
    ctx.font = '11px system-ui';
    const left = s.scrollLeft / ppf.current;
    const t = rulerTicks({ from: left, to: left + w / ppf.current, ppf: ppf.current, fps });
    for (const f of t.major) {
      const x = (f - left) * ppf.current;
      ctx.fillRect(x, RULER_H - 8, 1, 8);
      ctx.fillText(formatTimecode(f, doc.fps).replace(/\.\d+$/, ''), x + 3, 12);
    }
  }, [fps, doc.fps]);

  const updateRange = useCallback(() => {
    const s = scrollRef.current;
    if (!s) return;
    const next = visibleRange({
      scrollLeft: s.scrollLeft,
      width: s.clientWidth - HEADER_W,
      ppf: ppf.current,
      total,
    });
    setRange((r) =>
      Math.abs(r.from - next.from) + Math.abs(r.to - next.to) > (next.to - next.from) / 6 ? next : r,
    );
  }, [total]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: zoomTick = the zoom settled; redraw for the new scale
  useLayoutEffect(() => {
    contentRef.current?.style.setProperty('--ppf', String(ppf.current));
    drawRuler();
    updateRange();
  }, [drawRuler, updateRange, zoomTick]);

  // scroll → ruler + range, at most once per frame
  useEffect(() => {
    const s = scrollRef.current;
    if (!s) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        drawRuler();
        updateRange();
      });
    };
    s.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      s.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [drawRuler, updateRange]);

  // playhead: one rAF loop writing a transform (no React work per frame)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const f = playerRef.current?.frame ?? 0;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${f * ppf.current}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerRef]);

  // zoom: ctrl/⌘ + wheel or the slider; live = CSS variable only, settled = redraw visuals
  const settle = useRef(0);
  const setZoom = useCallback(
    (value: number, anchorClientX?: number) => {
      const s = scrollRef.current;
      const old = ppf.current;
      const next = Math.max(0.05, Math.min(24, value));
      ppf.current = next;
      contentRef.current?.style.setProperty('--ppf', String(next));
      if (s) {
        const ax =
          anchorClientX !== undefined
            ? anchorClientX - s.getBoundingClientRect().left - HEADER_W
            : s.clientWidth / 2;
        const frameAt = (s.scrollLeft + ax) / old;
        s.scrollLeft = frameAt * next - ax;
      }
      drawRuler();
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => setZoomTick((z) => z + 1), 150);
    },
    [drawRuler],
  );
  useEffect(() => {
    const s = scrollRef.current;
    if (!s) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(ppf.current * Math.exp(-e.deltaY / 300), e.clientX);
    };
    s.addEventListener('wheel', onWheel, { passive: false });
    return () => s.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  // --- gestures: measured once at pointerdown, DOM-only while moving, one command on release ---
  const gesture = useRef<null | {
    kind: 'move' | 'trim-start' | 'trim-end' | 'marquee' | 'seek';
    id?: string;
    node?: HTMLElement;
    x0: number;
    y0: number;
    left: number;
    top: number;
    edges: Int32Array;
    result?: { start: number; duration: number; track: number };
  }>(null);

  const contentPoint = (e: { clientX: number; clientY: number }, g: { left: number; top: number }) => ({
    // content coordinates of the clip area: x from frame 0, y from the top of the first track
    x: e.clientX - g.left - HEADER_W,
    y: e.clientY - g.top - RULER_H,
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const content = contentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const base = { left: rect.left, top: rect.top };
    const target = e.target as HTMLElement;
    const clip = target.closest<HTMLElement>('[data-clip]');
    const playhead = playerRef.current?.frame ?? 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (target.closest('[data-ruler]')) {
      gesture.current = { kind: 'seek', x0: e.clientX, y0: e.clientY, ...base, edges: new Int32Array() };
      const p = contentPoint(e, base);
      void playerRef.current?.seek(Math.max(0, Math.min(total - 1, Math.round(p.x / ppf.current))));
      return;
    }
    if (!clip) {
      gesture.current = { kind: 'marquee', x0: e.clientX, y0: e.clientY, ...base, edges: new Int32Array() };
      if (!e.shiftKey) onSelect([]);
      return;
    }
    const id = clip.dataset.clip as string;
    const el = doc.elements[id];
    if (!el) return;
    const edge = target.closest<HTMLElement>('[data-edge]')?.dataset.edge;
    onSelect(
      e.shiftKey
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id]
        : selected.includes(id)
          ? selected
          : [id],
    );
    gesture.current = {
      kind: edge === 'start' ? 'trim-start' : edge === 'end' ? 'trim-end' : 'move',
      id,
      node: clip,
      x0: e.clientX,
      y0: e.clientY,
      ...base,
      edges: buildEdges(doc, { exclude: id, extra: [playhead] }),
    };
    clip.style.willChange = 'transform';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    if (g.kind === 'seek') {
      const p = contentPoint(e, g);
      void playerRef.current?.seek(Math.max(0, Math.min(total - 1, Math.round(p.x / ppf.current))));
      return;
    }
    if (g.kind === 'marquee') {
      const m = marqueeRef.current;
      if (!m) return;
      const a = contentPoint({ clientX: g.x0, clientY: g.y0 }, g);
      const b = contentPoint(e, g);
      m.style.display = 'block';
      m.style.left = `${Math.min(a.x, b.x)}px`;
      m.style.top = `${Math.min(a.y, b.y)}px`;
      m.style.width = `${Math.abs(a.x - b.x)}px`;
      m.style.height = `${Math.abs(a.y - b.y)}px`;
      return;
    }
    const el = g.id ? doc.elements[g.id] : undefined;
    if (!el || !g.node) return;
    const trackIndex = doc.tracks.findIndex((t) => t.id === el.trackId);
    if (g.kind === 'move') {
      const r = dragMove({
        start: el.startFrame,
        duration: el.durationFrames,
        dxPx: dx,
        ppf: ppf.current,
        edges: g.edges,
        total,
      });
      const p = contentPoint(e, g);
      const track = trackAt(p.y, doc.tracks.length);
      g.result = { start: r.start, duration: el.durationFrames, track };
      g.node.style.transform = `translate(${(r.start - el.startFrame) * ppf.current}px, ${(track - trackIndex) * TRACK_H}px)`;
      g.node.dataset.snapped = r.snapped === null ? '' : 'true';
      return;
    }
    const media = el.type === 'video' || el.type === 'audio' ? el : null;
    const assetLen = media ? doc.assets?.[media.assetId]?.durationFrames : undefined;
    const maxEnd =
      media && assetLen !== undefined
        ? Math.min(total, el.startFrame + Math.floor((assetLen - media.sourceInFrame) / media.playbackRate))
        : total;
    const minStart = media
      ? Math.max(0, el.startFrame - Math.floor(media.sourceInFrame / media.playbackRate))
      : 0;
    const r = dragTrim({
      side: g.kind === 'trim-start' ? 'start' : 'end',
      start: el.startFrame,
      duration: el.durationFrames,
      dxPx: dx,
      ppf: ppf.current,
      edges: g.edges,
      maxEnd,
      minStart,
    });
    g.result = { ...r, track: trackIndex };
    g.node.style.left = `${r.start * ppf.current}px`;
    g.node.style.width = `${r.duration * ppf.current}px`;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'marquee') {
      const m = marqueeRef.current;
      if (m) m.style.display = 'none';
      if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) < 4) return;
      const a = contentPoint({ clientX: g.x0, clientY: g.y0 }, g);
      const b = contentPoint(e, g);
      const hits = marqueeHits(doc, { x0: a.x, x1: b.x, y0: a.y, y1: b.y }, ppf.current);
      onSelect(e.shiftKey ? [...new Set([...selected, ...hits])] : hits);
      return;
    }
    const node = g.node;
    if (node) {
      node.style.transform = '';
      node.style.left = '';
      node.style.width = '';
      node.style.willChange = '';
      delete node.dataset.snapped;
    }
    const el = g.id ? doc.elements[g.id] : undefined;
    const r = g.result;
    if (!el || !r || !g.id) return;
    if (g.kind === 'move') {
      const trackId = doc.tracks[r.track]?.id ?? el.trackId;
      if (r.start !== el.startFrame || trackId !== el.trackId)
        run(moveElement(g.id, { startFrame: r.start, trackId }));
    } else if (g.kind === 'trim-start' && r.start !== el.startFrame) run(trimStart(g.id, r.start));
    else if (g.kind === 'trim-end' && r.start + r.duration !== el.startFrame + el.durationFrames) {
      const end = r.start + r.duration;
      run(ripple ? rippleTrimEnd(g.id, end) : trimEnd(g.id, end));
    }
  };

  // keyboard: S split, Delete (⇧ = ripple), ⌘D duplicate — never while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      )
        return;
      const d = store.doc();
      const at = playerRef.current?.frame ?? 0;
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const targets = (selected.length ? selected : Object.keys(d.elements)).filter((id) => {
          const el = d.elements[id];
          return el && at > el.startFrame && at < el.startFrame + el.durationFrames;
        });
        for (const id of targets) run(split(id, at, crypto.randomUUID()));
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) {
        e.preventDefault();
        for (const id of selected) run(e.shiftKey ? rippleDelete(id) : deleteElement(id));
        onSelect([]);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selected.length) {
        e.preventDefault();
        for (const id of selected) run(duplicateElement(id, crypto.randomUUID()));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, selected, onSelect, playerRef, run]);

  const width = `calc(var(--ppf) * ${total}px + ${HEADER_W}px)`;
  return (
    <div className="rounded-xl border bg-card" data-testid="timeline">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        <label className="flex items-center gap-2">
          ซูม
          <input
            type="range"
            min={-3}
            max={3.2}
            step={0.05}
            defaultValue={Math.log(2)}
            onInput={(e) => setZoom(Math.exp(Number(e.currentTarget.value)))}
            aria-label="ซูมไทม์ไลน์"
            data-testid="timeline-zoom"
          />
        </label>
        <span className="text-muted-foreground">
          ⌘/Ctrl + ล้อเมาส์ = ซูม · S = แยก · Delete = ลบ (⇧ = ลบแล้วเลื่อนชิด) · ⌘D = ทำซ้ำ
        </span>
      </div>
      <div ref={scrollRef} className="relative max-h-[42vh] overflow-auto" data-testid="timeline-scroll">
        <div
          ref={contentRef}
          className="relative select-none"
          style={{ width, height: RULER_H + doc.tracks.length * TRACK_H + 8 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* ruler (sticky to the viewport, drawn for the visible range only) */}
          <div
            data-ruler
            className="sticky top-0 z-20 h-6 cursor-pointer border-b bg-card"
            style={{ marginLeft: HEADER_W }}
          >
            <canvas ref={rulerRef} className="sticky left-[152px] block h-6 text-muted-foreground" />
          </div>
          {doc.tracks.map((t, i) => (
            <div
              key={t.id}
              className="absolute right-0 left-0 border-b border-border/60"
              style={{ top: RULER_H + i * TRACK_H, height: TRACK_H }}
              data-track={t.id}
            >
              <TrackHeader
                name={TRACK_NAME[t.kind] ?? t.kind}
                index={i}
                count={doc.tracks.length}
                locked={Boolean(t.locked)}
                muted={Boolean(t.muted)}
                hasSound={t.kind === 'audio' || t.kind === 'video'}
                onUp={() => run(moveTrack(t.id, i - 1))}
                onDown={() => run(moveTrack(t.id, i + 1))}
                onLock={() => run(setTrackFlags(t.id, { locked: !t.locked }))}
                onMute={() => run(setTrackFlags(t.id, { muted: !t.muted }))}
              />
            </div>
          ))}
          <div className="absolute" style={{ left: HEADER_W, top: RULER_H, right: 0, bottom: 0 }}>
            {doc.tracks.flatMap((t, i) =>
              t.elementIds
                .map((id) => doc.elements[id])
                .filter(
                  (el): el is TimelineElement =>
                    !!el && el.startFrame < range.to && el.startFrame + el.durationFrames > range.from,
                )
                .map((el) => (
                  <Clip
                    key={el.id}
                    el={el}
                    top={i * TRACK_H}
                    selected={selected.includes(el.id)}
                    zoomTick={zoomTick}
                    ppf={ppf.current}
                    fps={doc.fps}
                    sourceId={'assetId' in el ? doc.assets?.[el.assetId]?.sourceId : undefined}
                    locked={Boolean(t.locked || el.locked)}
                  />
                )),
            )}
            <div
              ref={playheadRef}
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
              data-testid="timeline-playhead"
            />
            <div
              ref={marqueeRef}
              className="pointer-events-none absolute z-10 hidden border border-primary bg-primary/10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackHeader(p: {
  name: string;
  index: number;
  count: number;
  locked: boolean;
  muted: boolean;
  hasSound: boolean;
  onUp: () => void;
  onDown: () => void;
  onLock: () => void;
  onMute: () => void;
}) {
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  return (
    <div
      className="sticky left-0 z-10 flex h-full items-center gap-0.5 border-r bg-card px-2 text-xs"
      style={{ width: HEADER_W }}
      onPointerDown={stop}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        disabled={p.index === 0}
        onClick={p.onUp}
        aria-label={`เลื่อนแทร็ก${p.name}ขึ้น`}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        disabled={p.index === p.count - 1}
        onClick={p.onDown}
        aria-label={`เลื่อนแทร็ก${p.name}ลง`}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={p.onLock}
        aria-pressed={p.locked}
        aria-label={p.locked ? 'ปลดล็อกแทร็ก' : 'ล็อกแทร็ก'}
        data-testid="track-lock"
      >
        {p.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
      </Button>
      {p.hasSound ? (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={p.onMute}
          aria-pressed={p.muted}
          aria-label={p.muted ? 'เปิดเสียงแทร็ก' : 'ปิดเสียงแทร็ก'}
          data-testid="track-mute"
        >
          {p.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </Button>
      ) : null}
    </div>
  );
}

const CLIP_TONE: Record<string, string> = {
  video: 'bg-sky-700/80',
  image: 'bg-sky-600/70',
  audio: 'bg-emerald-700/80',
  caption: 'bg-amber-600/70',
  text: 'bg-fuchsia-700/70',
  cta: 'bg-fuchsia-800/70',
  shape: 'bg-slate-600/70',
};

function label(el: TimelineElement): string {
  if (el.type === 'text') return el.content.replace(/\n/g, ' ');
  if (el.type === 'caption') return el.words.map((w) => w.text).join('');
  if (el.type === 'cta') return el.label;
  return { video: 'วิดีโอ', audio: 'เสียง', image: 'ภาพ', shape: 'รูปทรง' }[el.type] ?? el.type;
}

function Clip({
  el,
  top,
  selected,
  zoomTick,
  ppf,
  fps,
  sourceId,
  locked,
}: {
  el: TimelineElement;
  top: number;
  selected: boolean;
  zoomTick: number;
  ppf: number;
  fps: TimelineDoc['fps'];
  sourceId: string | undefined;
  locked: boolean;
}) {
  const media = el.type === 'video' || el.type === 'audio';
  const r = media ? peakRange(el, fps) : null;
  return (
    <div
      data-clip={el.id}
      data-selected={selected || undefined}
      data-testid="timeline-clip"
      className={`group absolute overflow-hidden rounded-md border border-white/10 text-[11px] text-white ${CLIP_TONE[el.type] ?? 'bg-slate-600'} data-selected:ring-2 data-selected:ring-white data-[snapped=true]:ring-2 data-[snapped=true]:ring-yellow-300 ${locked ? 'opacity-60' : 'cursor-grab'}`}
      style={{
        top: top + 4,
        height: TRACK_H - 8,
        left: `calc(var(--ppf) * ${el.startFrame}px)`,
        width: `calc(var(--ppf) * ${el.durationFrames}px)`,
      }}
    >
      {media && r ? (
        <ClipVisual
          key={zoomTick}
          sourceId={sourceId}
          fromSec={r.fromSec}
          toSec={r.toSec}
          widthPx={el.durationFrames * ppf}
          filmstrip={el.type === 'video'}
        />
      ) : null}
      <span className="pointer-events-none relative z-[1] block truncate px-2 pt-0.5 drop-shadow">
        {label(el)}
      </span>
      {locked ? null : (
        <>
          <span
            data-edge="start"
            className="absolute top-0 left-0 z-[2] h-full w-1.5 cursor-ew-resize bg-white/0 group-hover:bg-white/50"
          />
          <span
            data-edge="end"
            className="absolute top-0 right-0 z-[2] h-full w-1.5 cursor-ew-resize bg-white/0 group-hover:bg-white/50"
          />
        </>
      )}
    </div>
  );
}
