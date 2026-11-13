/** Assumption: five deterministic energy recipes. Durations are seconds; Project JSON stores integer frames. */
export const ENERGY_IDS = ['calm', 'gentle', 'normal', 'lively', 'hype'] as const;
export type Energy = (typeof ENERGY_IDS)[number];
export const GRAPHIC_IDS = [
  'hook-title',
  'price-tag',
  'promo-badge',
  'stat-counter',
  'review-card',
  'feature-callout',
  'step-list',
  'before-after',
  'lower-third',
  'cta-card',
  'logo-sting',
  'live-comment',
  'sticker-pop',
] as const;
export type GraphicKind = (typeof GRAPHIC_IDS)[number];
export const MOTION_TOKENS: Record<
  Energy,
  {
    enter: number;
    exit: number;
    move: number;
    drift: number;
    stagger: number;
    holdBase: number;
    holdWord: number;
  }
> = {
  calm: { enter: 0.7, exit: 0.3, move: 0.8, drift: 0.008, stagger: 0.12, holdBase: 2.4, holdWord: 0.55 },
  gentle: { enter: 0.58, exit: 0.26, move: 0.65, drift: 0.016, stagger: 0.1, holdBase: 2, holdWord: 0.48 },
  normal: { enter: 0.45, exit: 0.22, move: 0.5, drift: 0.027, stagger: 0.08, holdBase: 1.5, holdWord: 0.4 },
  lively: { enter: 0.36, exit: 0.18, move: 0.4, drift: 0.036, stagger: 0.06, holdBase: 1.05, holdWord: 0.32 },
  hype: { enter: 0.3, exit: 0.15, move: 0.32, drift: 0.045, stagger: 0.04, holdBase: 0.6, holdWord: 0.24 },
};
export function motionFrames(energy: Energy, words: number, fps: { num: number; den: number }) {
  const t = MOTION_TOKENS[energy],
    f = (s: number) => Math.max(1, Math.ceil((s * fps.num) / fps.den));
  return {
    enter: f(t.enter),
    exit: f(t.exit),
    move: f(t.move),
    stagger: f(t.stagger),
    hold: f(t.holdBase + t.holdWord * Math.max(1, words)),
    drift: t.drift,
  };
}
