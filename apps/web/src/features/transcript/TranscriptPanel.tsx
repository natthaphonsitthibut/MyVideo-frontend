import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, CircleAlert, LocateFixed, RotateCcw, Search } from 'lucide-react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError } from '@/api/client';
import { formatDuration } from '@/api/sources';
import {
  type TranscriptSegment,
  useStartTranscript,
  useTranscriptSegments,
  useTranscriptState,
} from '@/api/transcripts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buildWordIndex, findSegmentAt, findWordAt, searchSegments } from './word-index';

type VideoRef = RefObject<HTMLVideoElement | null>;
const EMPTY: TranscriptSegment[] = [];

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string } | null;
    if (body?.message) return body.message;
  }
  return 'เริ่มถอดเสียงไม่สำเร็จ ลองใหม่อีกครั้ง';
}

/** Transcript beside the player: start/progress while transcribing, then the synced, searchable viewer. */
export function TranscriptPanel({
  sourceId,
  hasAudio,
  videoRef,
}: {
  sourceId: string;
  hasAudio: boolean | null;
  videoRef: VideoRef;
}) {
  const state = useTranscriptState(sourceId);
  const start = useStartTranscript(sourceId);
  const t = state.data;

  let body: React.ReactNode;
  if (!t) {
    body = <Skeleton className="h-24 w-full" />;
  } else if (t.status === 'ready' && t.transcriptId) {
    return <TranscriptViewer sourceId={sourceId} transcriptId={t.transcriptId} videoRef={videoRef} />;
  } else if (t.status === 'running') {
    const planned = t.chunkCount > 0;
    const p = planned ? t.chunksDone / t.chunkCount : 0;
    body = (
      <div className="space-y-2" role="status" data-testid="transcript-running">
        <p className="text-sm">
          {planned ? `กำลังถอดเสียง… ช่วงที่เสร็จ ${t.chunksDone}/${t.chunkCount}` : 'กำลังหาช่วงที่มีเสียงพูด…'}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-300"
            style={{ transform: `scaleX(${Math.max(0.03, p)})` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">ปิดหน้านี้ได้ ระบบทำต่อเองเบื้องหลัง</p>
      </div>
    );
  } else {
    const failed = t.status === 'failed';
    body = (
      <div className="space-y-3">
        {failed ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasAudio === false
              ? 'วิดีโอนี้ไม่มีเสียง จึงถอดเสียงไม่ได้'
              : 'ถอดเสียงพูดเป็นข้อความ เพื่ออ่าน ค้นหา และกดคำเพื่อกระโดดไปยังช่วงนั้น'}
          </p>
        )}
        <Button
          onClick={() => start.mutate()}
          disabled={start.isPending || hasAudio === false}
          data-testid="transcript-start"
        >
          {failed ? <RotateCcw /> : null}
          {failed ? 'ถอดเสียงอีกครั้ง' : 'ถอดเสียงวิดีโอนี้'}
        </Button>
        {start.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(start.error)}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <section className="rounded-xl border bg-card p-4" aria-label="คำถอดเสียง">
      <h2 className="mb-3 font-medium">คำถอดเสียง</h2>
      {body}
    </section>
  );
}

/**
 * The synced transcript (editor-performance rules): one rAF loop reads the video clock, finds the current word by
 * binary search and toggles `data-active` on its DOM node — React does not re-render during playback or scroll
 * (`directDomUpdates`). Click a word or a timecode to seek.
 */
function TranscriptViewer({
  sourceId,
  transcriptId,
  videoRef,
}: {
  sourceId: string;
  transcriptId: string;
  videoRef: VideoRef;
}) {
  const segs = useTranscriptSegments(sourceId, transcriptId);
  const segments = segs.data ?? EMPTY;
  const index = useMemo(() => buildWordIndex(segments), [segments]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,
    overscan: 6,
    getItemKey: (i) => segments[i]?.seq ?? i,
    directDomUpdates: true,
  });

  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const matches = useMemo(() => searchSegments(segments, deferred), [segments, deferred]);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const [matchPos, setMatchPos] = useState(0);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const stopFollowing = () => {
    if (!followRef.current) return;
    followRef.current = false;
    setFollowing(false);
  };

  // playback loop: current word + current segment, written to the DOM
  useEffect(() => {
    let raf = 0;
    let word = -1;
    let seg = -1;
    const tick = () => {
      const v = videoRef.current;
      const root = scrollRef.current;
      if (v && root && index.count > 0) {
        const ms = v.currentTime * 1000;
        const w = findWordAt(index, ms);
        if (w !== word) {
          root.querySelector(`[data-w="${word}"]`)?.removeAttribute('data-active');
          word = w;
        }
        // rows are re-created while scrolling, so re-apply to the current node if needed
        const wEl = w >= 0 ? root.querySelector(`[data-w="${w}"]`) : null;
        if (wEl && !wEl.hasAttribute('data-active')) wEl.setAttribute('data-active', '');
        const s = findSegmentAt(index, ms);
        if (s !== seg) {
          root.querySelector(`[data-seg="${seg}"]`)?.removeAttribute('data-current');
          seg = s;
          if (followRef.current && !v.paused) virtualizer.scrollToIndex(s, { align: 'auto' });
        }
        const sEl = s >= 0 ? root.querySelector(`[data-seg="${s}"]`) : null;
        if (sEl && !sEl.hasAttribute('data-current')) sEl.setAttribute('data-current', '');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, videoRef, virtualizer]);

  const goToMatch = (pos: number) => {
    if (matches.length === 0) return;
    const p = ((pos % matches.length) + matches.length) % matches.length;
    setMatchPos(p);
    stopFollowing();
    virtualizer.scrollToIndex(matches[p] ?? 0, { align: 'center' });
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    goToMatch(matchPos + (e.shiftKey ? -1 : 1));
  };
  const seekFrom = (e: MouseEvent<HTMLElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-start]');
    const v = videoRef.current;
    if (!el || !v) return;
    v.currentTime = Number(el.dataset.start) / 1000;
  };
  const resumeFollow = () => {
    followRef.current = true;
    setFollowing(true);
    const v = videoRef.current;
    if (v) virtualizer.scrollToIndex(findSegmentAt(index, v.currentTime * 1000), { align: 'center' });
  };

  const current = matches[matchPos] ?? -1;
  return (
    <section
      className="flex h-[min(70vh,640px)] flex-col rounded-xl border bg-card"
      aria-label="คำถอดเสียง"
      data-testid="transcript"
    >
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">คำถอดเสียง</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{segments.length} ช่วง</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMatchPos(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="ค้นหาคำ เช่น ราคา"
              aria-label="ค้นหาในคำถอดเสียง"
              className="pl-8"
              data-testid="transcript-search"
            />
          </div>
          <span
            className="w-14 shrink-0 text-center text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
            data-testid="transcript-match-count"
          >
            {deferred.trim() ? `${matches.length ? matchPos + 1 : 0}/${matches.length}` : ''}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ผลก่อนหน้า"
            disabled={!matches.length}
            onClick={() => goToMatch(matchPos - 1)}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ผลถัดไป"
            disabled={!matches.length}
            onClick={() => goToMatch(matchPos + 1)}
          >
            <ChevronDown />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {segs.isPending ? (
          <div className="space-y-3 p-3" role="status" aria-label="กำลังโหลดคำถอดเสียง">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
          </div>
        ) : segments.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">ไม่พบเสียงพูดในวิดีโอนี้</p>
        ) : (
          // biome-ignore lint/a11y/noStaticElementInteractions: word clicks are a mouse shortcut; every row has a focusable timecode button
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users seek with the row's timecode button
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overscroll-contain"
            onClick={seekFrom}
            onWheel={stopFollowing}
            onTouchMove={stopFollowing}
            data-testid="transcript-scroll"
          >
            <div ref={virtualizer.containerRef} className="relative w-full">
              {virtualizer.getVirtualItems().map((item) => {
                const seg = segments[item.index];
                if (!seg) return null;
                const first = index.firstWord[item.index] ?? 0;
                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    data-seg={item.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      'absolute top-0 left-0 flex w-full gap-3 border-l-2 border-transparent px-3 py-2 data-current:border-primary data-current:bg-primary/5',
                      matchSet.has(item.index) && 'bg-warning/10',
                      item.index === current && 'outline-2 -outline-offset-2 outline-warning',
                    )}
                  >
                    <button
                      type="button"
                      data-start={seg.startMs}
                      className="h-fit shrink-0 rounded px-1 text-xs text-muted-foreground tabular-nums hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label={`ไปที่ ${formatDuration(seg.startMs)}`}
                    >
                      {formatDuration(seg.startMs)}
                    </button>
                    <p className="min-w-0 text-[15px] leading-7 break-words">
                      {seg.words.map((w, wi) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: words are positional inside an immutable segment
                          key={wi}
                          data-w={first + wi}
                          data-start={w.startMs}
                          className="mr-[0.2em] cursor-pointer rounded-sm px-px hover:bg-muted data-active:bg-primary data-active:text-primary-foreground"
                        >
                          {w.text}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!following ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-3 bottom-3 shadow-md"
            onClick={resumeFollow}
          >
            <LocateFixed />
            ไปที่กำลังเล่น
          </Button>
        ) : null}
      </div>
    </section>
  );
}
