import { describe, expect, it } from 'vitest';
import { formatTimecode, frameToMs, frameToSeconds, msToFrame, secondsToFrame } from './frames';

const NTSC = { num: 30000, den: 1001 };
const P30 = { num: 30, den: 1 };
const TWO_HOURS = (fps: { num: number; den: number }) => Math.ceil((2 * 3600 * fps.num) / fps.den);

describe('frame math', () => {
  it.each([
    ['29.97', NTSC],
    ['30', P30],
  ])('no drift at %s fps over 2 hours of frames (every frame round-trips)', (_n, fps) => {
    const n = TWO_HOURS(fps);
    for (let f = 0; f <= n; f++) {
      if (msToFrame(frameToMs(f, fps), fps) !== f) throw new Error(`ms round-trip broke at frame ${f}`);
      if (secondsToFrame(frameToSeconds(f, fps), fps) !== f)
        throw new Error(`seconds round-trip broke at ${f}`);
    }
    expect(n).toBeGreaterThan(200_000);
  });

  it('video clock → frame: a time inside a frame maps to that frame', () => {
    expect(secondsToFrame(0.0333, P30)).toBe(0);
    expect(secondsToFrame(0.034, P30)).toBe(1);
    expect(secondsToFrame(1, NTSC)).toBe(29); // 29.97 frames in 1 s
    expect(secondsToFrame(1001 / 30000, NTSC)).toBe(1);
  });

  it('2 h at 29.97 = 215 784.2 frames; frame 215 784 starts at 7 199 992.8 ms', () => {
    expect(TWO_HOURS(NTSC)).toBe(215_785); // rounded up: the partial last frame is covered
    expect(frameToMs(215_784, NTSC)).toBeCloseTo(7_199_992.8, 6);
    expect(secondsToFrame(7200, NTSC)).toBe(215_784);
  });

  it('timecode for display', () => {
    expect(formatTimecode(0, P30)).toBe('0:00.00');
    expect(formatTimecode(95, P30)).toBe('0:03.05');
    expect(formatTimecode(30 * 3725, P30)).toBe('1:02:05.00');
  });
});
