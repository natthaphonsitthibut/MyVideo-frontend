import { createPlayer, mountStage, type Player, type StageAsset, type StageProject } from '@myvideo/stage';
import { formatTimecode } from '@myvideo/timeline-core';
import { Pause, Play } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/api/client';
import { Button } from '@/components/ui/button';

/** Preview media = source proxies (editor-performance: never play originals in the browser). */
const proxyUrl = (_id: string, asset: StageAsset) => `${API_BASE_URL}/sources/${asset.sourceId}/assets/proxy`;

/**
 * React wrapper around the stage + preview driver (editor-performance): React renders once per project; the
 * playhead, timecode and scrub position are written to the DOM from the player's subscription — no React render
 * per frame or per pointer move. Only `playing` (play/pause icon) is React state.
 */
export function PreviewPlayer({
  project,
  onPlayer,
}: {
  project: StageProject;
  /** Hands the transient player to a parent (e.g. a timeline) without React state. */
  onPlayer?: (p: Player | null) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [playing, setPlaying] = useState(false);
  const total = project.durationFrames;

  // scale the 1080×1920 stage to the available box (one CSS transform, no re-layout per frame)
  useLayoutEffect(() => {
    const box = frameRef.current;
    const host = hostRef.current;
    if (!box || !host) return;
    const fitStage = () => {
      const s = Math.min(box.clientWidth / project.width, box.clientHeight / project.height);
      host.style.transform = `scale(${s})`;
      host.style.width = `${project.width}px`;
      host.style.height = `${project.height}px`;
      box.style.setProperty('--stage-w', `${project.width * s}px`);
    };
    const ro = new ResizeObserver(fitStage);
    ro.observe(box);
    fitStage();
    return () => ro.disconnect();
  }, [project.width, project.height]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = mountStage(host, project, proxyUrl);
    const player = createPlayer(stage, project);
    playerRef.current = player;
    onPlayer?.(player);
    let lastPlaying = false;
    const off = player.subscribe(({ frame, playing: p }) => {
      if (headRef.current)
        headRef.current.style.transform = `translateX(${(frame / Math.max(1, total - 1)) * 100}cqw)`;
      if (timeRef.current)
        timeRef.current.textContent = `${formatTimecode(frame, project.fps)} / ${formatTimecode(total, project.fps)}`;
      trackRef.current?.setAttribute('aria-valuenow', String(frame));
      if (p !== lastPlaying) {
        lastPlaying = p;
        setPlaying(p); // the only React update: start/stop
      }
    });
    void stage.ready().then(() => player.seek(0));
    return () => {
      off();
      onPlayer?.(null);
      player.destroy();
      stage.destroy();
      playerRef.current = null;
    };
  }, [project, total, onPlayer]);

  // scrub: measure once per gesture; latest seek wins (player.seek drops stale ones)
  const gesture = useRef({ active: false, left: 0, width: 1 });
  const frameAt = (x: number) =>
    Math.round(Math.max(0, Math.min(1, (x - gesture.current.left) / gesture.current.width)) * (total - 1));
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    gesture.current = { active: true, left: r.left, width: r.width };
    e.currentTarget.setPointerCapture(e.pointerId);
    void playerRef.current?.seek(frameAt(e.clientX));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (gesture.current.active) void playerRef.current?.seek(frameAt(e.clientX));
  };
  const onUp = () => {
    gesture.current.active = false;
  };
  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    void (p.playing ? p.pause() : p.play());
  };
  const onKey = (e: KeyboardEvent) => {
    const p = playerRef.current;
    if (!p) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === ' ') toggle();
    else if (e.key === 'ArrowRight') void p.seek(p.frame + step);
    else if (e.key === 'ArrowLeft') void p.seek(p.frame - step);
    else return;
    e.preventDefault();
  };

  return (
    <div className="space-y-3" data-testid="preview-player">
      <div
        ref={frameRef}
        className="relative mx-auto flex h-[min(70vh,720px)] w-full justify-center overflow-hidden rounded-xl bg-black"
      >
        <div style={{ width: 'var(--stage-w)', overflow: 'hidden' }}>
          <div ref={hostRef} style={{ transformOrigin: '0 0' }} data-testid="preview-stage" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="secondary"
          onClick={toggle}
          aria-label={playing ? 'หยุด' : 'เล่น'}
          data-testid="preview-toggle"
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="ตำแหน่งในคลิป"
          aria-valuemin={0}
          aria-valuemax={total - 1}
          aria-valuenow={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onKeyDown={onKey}
          className="relative h-8 flex-1 cursor-pointer touch-none rounded-md bg-muted outline-none [container-type:inline-size] focus-visible:ring-[3px] focus-visible:ring-ring/50"
          data-testid="preview-track"
        >
          <div
            ref={headRef}
            className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-destructive"
            aria-hidden
          />
        </div>
        <span ref={timeRef} className="w-36 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          0:00.00
        </span>
      </div>
    </div>
  );
}
