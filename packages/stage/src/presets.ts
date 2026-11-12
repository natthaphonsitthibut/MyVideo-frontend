/**
 * In/out animation presets (WAAPI keyframes; no GSAP — D-015). Driven by the stage from the frame number, so they
 * are deterministic. `out` plays the `in` keyframes backwards.
 */
const PRESETS: Record<string, Keyframe[]> = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  bounce: [
    { opacity: 0, transform: 'translateY(-64px)' },
    { opacity: 1, transform: 'translateY(12px)', offset: 0.65 },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  'zoom-in': [
    { opacity: 0, transform: 'scale(1.3)' },
    { opacity: 1, transform: 'scale(1)' },
  ],
  'slide-up': [
    { opacity: 0, transform: 'translateY(48px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  pop: [
    { opacity: 0, transform: 'scale(0.6)' },
    { opacity: 1, transform: 'scale(1.06)', offset: 0.7 },
    { opacity: 1, transform: 'scale(1)' },
  ],
};

export const ANIMATION_PRESETS = Object.keys(PRESETS);

export function animationKeyframes(presetId: string, dir: 'in' | 'out'): Keyframe[] {
  const kf = PRESETS[presetId] ?? PRESETS.fade ?? [];
  if (dir === 'in') return kf;
  return [...kf]
    .reverse()
    .map((k) => (k.offset === undefined ? k : { ...k, offset: 1 - (k.offset as number) }));
}
