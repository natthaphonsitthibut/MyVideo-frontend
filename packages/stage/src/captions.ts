import { wordGap } from './caption-layout';
import { STAGE_FONT } from './styles';
import type { StageElement } from './types';

type Caption = Extract<StageElement, { type: 'caption' }>;

/** Caption looks. Font size/line height drive both the builder's measure and the rendering (keep in sync). */
export const CAPTION_STYLES = {
  clean: { fontWeight: 600, fontSize: 64, lineHeight: 1.5, color: '#ffffff', active: '#ffffff' },
  'bold-highlight': { fontWeight: 800, fontSize: 68, lineHeight: 1.5, color: '#ffffff', active: '#facc15' },
} as const;
export type CaptionStyleId = keyof typeof CAPTION_STYLES;

/** CSS font shorthand for `canvasMeasure` so lines are measured exactly as they are drawn. */
export const captionFont = (styleRef: string): string => {
  const s = CAPTION_STYLES[styleRef as CaptionStyleId] ?? CAPTION_STYLES.clean;
  return `${s.fontWeight} ${s.fontSize}px ${STAGE_FONT}`;
};

/** 9:16 safe area (platform UI covers the top bar and the bottom caption/buttons). */
export const SAFE = { side: 108, top: 240, bottom: 360 };
export const captionMaxWidth = (canvasWidth: number) => canvasWidth - 2 * SAFE.side;

/**
 * Builds the caption DOM: one block per STORED line, `white-space: nowrap` (the browser never re-wraps Thai),
 * one span per word (`data-w`), placed in the safe area around `transform.y`.
 */
export function buildCaptionNode(
  box: HTMLElement,
  inner: HTMLElement,
  e: Caption,
  width: number,
  height: number,
) {
  const s = CAPTION_STYLES[e.styleRef as CaptionStyleId] ?? CAPTION_STYLES.clean;
  const lineH = s.fontSize * s.lineHeight;
  const boxH = e.lines.length * lineH;
  // centre at canvas centre + y, clamped so every line stays inside the safe area
  const centre = Math.min(
    Math.max(height / 2 + e.transform.y, SAFE.top + boxH / 2),
    height - SAFE.bottom - boxH / 2,
  );
  box.style.cssText += `left:${SAFE.side}px;top:${centre - boxH / 2}px;width:${width - 2 * SAFE.side}px;height:${boxH}px;`;
  inner.style.cssText += `font-family:${STAGE_FONT};font-weight:${s.fontWeight};font-size:${s.fontSize}px;line-height:${s.lineHeight};color:${s.color};text-align:center;-webkit-text-stroke:${Math.round(s.fontSize / 7)}px #000;paint-order:stroke fill;`;
  inner.style.setProperty('--active', s.active);
  for (const line of e.lines) {
    const row = document.createElement('div');
    row.style.whiteSpace = 'nowrap';
    line.forEach((wi, k) => {
      const span = document.createElement('span');
      span.dataset.w = String(wi);
      span.textContent = e.words[wi]?.text ?? '';
      row.appendChild(span);
      if (k < line.length - 1) {
        const gap = wordGap(span.textContent, e.words[line[k + 1] as number]?.text ?? '');
        if (gap) row.appendChild(document.createTextNode(gap));
      }
    });
    inner.appendChild(row);
  }
}

/** Marks the spoken word (pure from the frame); the colour comes from the style's `--active`. */
export function applyActiveWord(inner: HTMLElement, active: number) {
  const prev = inner.querySelector<HTMLElement>('[data-active]');
  if (prev && prev.dataset.w === String(active)) return;
  if (prev) {
    prev.removeAttribute('data-active');
    prev.style.color = '';
  }
  if (active < 0) return;
  const el = inner.querySelector<HTMLElement>(`[data-w="${active}"]`);
  if (el) {
    el.dataset.active = '';
    el.style.color = 'var(--active)';
  }
}
