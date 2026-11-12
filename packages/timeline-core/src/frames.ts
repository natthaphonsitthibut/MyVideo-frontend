/** Rational frame rate (ARCHITECTURE §6): 29.97 = {num: 30000, den: 1001}. Project times are integer frames. */
export type Fps = { num: number; den: number };

/** Start of a frame in milliseconds (display/IO only — never stored). */
export const frameToMs = (frame: number, fps: Fps): number => (frame * 1000 * fps.den) / fps.num;

/** Start of a frame in seconds (for `video.currentTime`). */
export const frameToSeconds = (frame: number, fps: Fps): number => (frame * fps.den) / fps.num;

/** Nearest frame to a millisecond time (ASR word times → frames). */
export const msToFrame = (ms: number, fps: Fps): number => Math.round((ms * fps.num) / (1000 * fps.den));

/**
 * The frame being shown at a clock time: floor, with a tiny tolerance so a time computed from a frame start
 * (`frameToSeconds`) maps back to that same frame despite binary floating point.
 */
export const secondsToFrame = (seconds: number, fps: Fps): number =>
  Math.floor((seconds * fps.num) / fps.den + 1e-6);

/** `H:MM:SS.ff` / `M:SS.ff` (ff = frame within the second) for display. */
export function formatTimecode(frame: number, fps: Fps): string {
  const totalSeconds = Math.floor((frame * fps.den) / fps.num + 1e-9);
  const ff = frame - Math.ceil((totalSeconds * fps.num) / fps.den - 1e-9);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const tail = `${String(s).padStart(2, '0')}.${String(ff).padStart(2, '0')}`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${tail}` : `${m}:${tail}`;
}
