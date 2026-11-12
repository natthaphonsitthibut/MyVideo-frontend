import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Stage } from './mount';
import { createPlayer } from './player';

/**
 * Measured on a real AI clip (E12-F01, 2026-11-13): at 4 of 5 jump cuts the shown frame went back by one —
 * the clock re-anchors to the video, which reports a slightly earlier time right after its cut seek.
 */
describe('preview player clock', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([0.5, 2])('keeps timeline time at normal speed when media plays at %sx', async (rate) => {
    let now = 0;
    const callbacks: ((t: number) => void)[] = [];
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => callbacks.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    // The decoder advances in source seconds at the configured rate; timeline seconds still advance 1:1.
    const el = {
      paused: false,
      seeking: false,
      readyState: 4,
      muted: true,
      playbackRate: rate,
      get currentTime() {
        return 1 + (now * rate) / 1000;
      },
      play: async () => {},
    };
    const stage = {
      root: { querySelectorAll: () => [] },
      seek: async () => undefined,
      draw: (f: number) => [{ el, time: 1 + (f * rate) / 30 }],
    } as unknown as Stage;
    const player = createPlayer(stage, { fps: { num: 30, den: 1 }, durationFrames: 600 });
    await player.play();
    for (let t = 16; t <= 5000; t += 16) {
      now = t;
      callbacks.shift()?.(t);
      expect(Math.abs(player.frame - Math.floor((t * 30) / 1000)), `timeline at ${t} ms`).toBeLessThanOrEqual(
        1,
      );
    }
    player.destroy();
  });

  it('never shows an earlier frame while playing, even when the video lags right after a cut', async () => {
    let now = 0;
    const callbacks: ((t: number) => void)[] = [];
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => callbacks.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    // the main video: in sync, except it reports 130 ms behind once (just after a jump-cut seek)
    let lagMs = 0;
    const el = {
      paused: false,
      seeking: false,
      readyState: 4,
      muted: true,
      playbackRate: 1,
      currentTime: 0,
      play: async () => {},
    };
    const stage = {
      root: { querySelectorAll: () => [] },
      seek: async () => undefined,
      draw: (f: number) => {
        el.currentTime = f / 30 - lagMs / 1000;
        return [{ el, time: f / 30 }];
      },
    } as unknown as Stage;
    const player = createPlayer(stage, { fps: { num: 30, den: 1 }, durationFrames: 300 });
    const shown: number[] = [];
    player.subscribe(({ frame }) => shown.push(frame));
    await player.play();

    const step = (ms: number) => {
      now = ms;
      const cb = callbacks.shift();
      cb?.(ms);
    };
    for (let t = 16; t <= 1000; t += 16) step(t);
    lagMs = 130; // the cut
    step(1016);
    lagMs = 0;
    for (let t = 1032; t <= 1500; t += 16) step(t);

    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeGreaterThanOrEqual(shown[i - 1] ?? 0);
    // it kept playing; the clock follows the video, so it ends ~130 ms (4 frames) behind the wall clock's 45
    expect(shown.at(-1)).toBeGreaterThanOrEqual(40);
  });
});
