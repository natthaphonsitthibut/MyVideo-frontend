import { frameToSeconds, secondsToFrame } from '@myvideo/timeline-core';
import type { Stage } from './mount';
import type { StageProject } from './types';

export type Player = {
  readonly playing: boolean;
  readonly frame: number;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Frame-exact seek (pauses first). Calls during a running seek: the latest one wins. */
  seek(frame: number): Promise<void>;
  /** Transient state for the timeline/controls: frame + playing, delivered without React. */
  subscribe(fn: (s: { frame: number; playing: boolean }) => void): () => void;
  destroy(): void;
};

/** Video/audio further than this from the master clock is corrected by a small seek (editor-performance). */
const DRIFT_FRAMES = 2;
/**
 * Pre-roll for jump cuts (A/B lanes): the hidden decoder is started this long before its cut so it is moving
 * when shown. How long a started `<video>` takes before its picture advances varies by machine (a 0.12 s guess
 * overshot by 73 ms in Chrome here, E12-F01); the estimate adapts at every cut from how far the decoder actually
 * landed, and the stage tolerates a small miss (the clock follows the video). Margin = extra head start.
 */
const START_LATENCY_S = 0.04;
const PREROLL_MARGIN_S = 0.06;

/**
 * Preview driver (ARCHITECTURE §7): ONE master clock (`performance.now()`), every visible media element follows it
 * (play, and a small seek when it drifts > 2 frames). One rAF loop draws the stage; nothing here is React.
 * Pausing lands on an exact frame through `stage.seek`.
 */
export function createPlayer(stage: Stage, project: Pick<StageProject, 'fps' | 'durationFrames'>): Player {
  const fps = project.fps;
  let playing = false;
  let frame = 0;
  let startAt = 0;
  let startFrame = 0;
  let raf = 0;
  let seekToken = 0;
  const subs = new Set<(s: { frame: number; playing: boolean }) => void>();
  const emit = () => {
    for (const s of subs) s({ frame, playing });
  };
  const driftS = frameToSeconds(DRIFT_FRAMES, fps);

  const halfFrameMs = frameToSeconds(1, fps) * 500;
  const frameS = frameToSeconds(1, fps);
  let latencyS = START_LATENCY_S;
  /** Decoders started early, with the source time they must show at their cut. */
  const rolling = new Map<HTMLMediaElement, { cutFrame: number; time: number }>();

  /** Starts hidden decoders whose cut is close so they already move when shown (stage `upcoming`). */
  const preroll = (f: number) => {
    const within = Math.ceil((latencyS + PREROLL_MARGIN_S) / frameS);
    for (const u of stage.upcoming?.(f, within) ?? []) {
      if (rolling.has(u.el) || !u.el.paused) continue;
      const untilCutS = (u.cutFrame - f) * frameS;
      // start where it will be exactly at the cut once it really moves (after the start latency)
      u.el.currentTime = Math.max(0, u.time - Math.max(0, untilCutS - latencyS));
      u.el.muted = true;
      void u.el.play().catch(() => undefined);
      rolling.set(u.el, { cutFrame: u.cutFrame, time: u.time });
    }
  };
  /** At a cut: learn the real start latency from how far the pre-rolled decoder landed. */
  const landed = (el: HTMLMediaElement, f: number) => {
    const r = rolling.get(el);
    if (!r) return;
    rolling.delete(el);
    if (f !== r.cutFrame) return;
    const behindS = r.time - el.currentTime; // > 0: it started later than estimated
    latencyS = Math.min(0.4, Math.max(0.02, latencyS + behindS * 0.5));
  };

  const tick = (now: number) => {
    if (!playing) return;
    let f = startFrame + secondsToFrame((now - startAt) / 1000, fps);
    // media is the master clock: re-anchor the clock to the main (lowest-track) playing media when it differs by
    // more than half a frame — start-up latency and decoder hiccups are absorbed here, not shown as drift.
    const main = stage.draw(Math.min(f, project.durationFrames - 1))[0];
    if (main && !main.el.paused && !main.el.seeking && main.el.readyState >= 3) {
      // Decoder times are source seconds; the master clock uses timeline seconds.
      const errMs = ((main.el.currentTime - main.time) * 1000) / main.el.playbackRate;
      if (Math.abs(errMs) > halfFrameMs) {
        startAt -= errMs;
        f = startFrame + secondsToFrame((now - startAt) / 1000, fps);
      }
    }
    // a video that reports a slightly earlier time right after its cut seek pulls the clock back: hold the frame
    // instead of showing an earlier one (measured on a real AI clip: one frame back at 4 of 5 jump cuts)
    f = Math.max(f, frame);
    if (f >= project.durationFrames) {
      void api.pause().then(() => api.seek(project.durationFrames - 1));
      return;
    }
    if (f !== frame) {
      frame = f;
      for (const [i, m] of stage.draw(f).entries()) {
        landed(m.el, f);
        // the main media leads; the others follow the clock (small seek when > 2 frames off)
        if (i > 0 && Math.abs(m.el.currentTime - m.time) > driftS) m.el.currentTime = m.time;
        if (m.el.paused) void m.el.play().catch(() => undefined);
        if (m.el.muted) m.el.muted = false; // a pre-rolled decoder was muted until shown
      }
      preroll(f);
      emit();
    }
    raf = requestAnimationFrame(tick);
  };

  const stopMedia = () => {
    rolling.clear();
    for (const el of stage.root.querySelectorAll<HTMLMediaElement>('video, audio')) {
      el.pause();
      el.muted = true;
    }
  };

  const api: Player = {
    get playing() {
      return playing;
    },
    get frame() {
      return frame;
    },
    async play() {
      if (playing) return;
      if (frame >= project.durationFrames - 1) frame = 0;
      await stage.seek(frame); // media ready at the start frame before the clock starts
      playing = true;
      startFrame = frame;
      startAt = performance.now();
      for (const m of stage.draw(frame)) {
        m.el.muted = false;
        void m.el.play().catch(() => undefined);
      }
      emit();
      raf = requestAnimationFrame(tick);
    },
    async pause() {
      if (!playing) return;
      playing = false;
      cancelAnimationFrame(raf);
      stopMedia();
      await stage.seek(frame);
      emit();
    },
    async seek(f) {
      const token = ++seekToken;
      if (playing) {
        playing = false;
        cancelAnimationFrame(raf);
        stopMedia();
      }
      frame = Math.max(0, Math.min(project.durationFrames - 1, Math.round(f)));
      emit();
      await stage.seek(frame);
      if (token !== seekToken) return; // a newer seek is in charge
    },
    subscribe(fn) {
      subs.add(fn);
      fn({ frame, playing });
      return () => subs.delete(fn);
    },
    destroy() {
      playing = false;
      cancelAnimationFrame(raf);
      stopMedia();
      subs.clear();
    },
  };
  return api;
}
