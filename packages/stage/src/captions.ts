import { wordGap } from './caption-layout';
import { STAGE_FONT } from './styles';
import type { StageElement } from './types';

type Caption = Extract<StageElement, { type: 'caption' }>;

/** Caption looks. Font size/line height drive both the builder's measure and the rendering (keep in sync). */
export const CAPTION_STYLES = {
  clean: { fontWeight: 600, fontSize: 64, lineHeight: 1.5, color: '#ffffff', active: '#ffffff' },
  'bold-highlight': { fontWeight: 800, fontSize: 68, lineHeight: 1.5, color: '#ffffff', active: '#facc15' },
  'pop-word': { fontWeight: 900, fontSize: 76, lineHeight: 1.5, color: '#ffffff', active: '#facc15' },
  boxed: { fontWeight: 600, fontSize: 60, lineHeight: 1.6, color: '#ffffff', active: '#facc15' },
  'outline-bold': { fontWeight: 900, fontSize: 72, lineHeight: 1.5, color: '#ffffff', active: '#67e8f9' },
  // weight 500 + firm shadow: 400 with a soft shadow was hard to read on bright product colours (S01a renders)
  minimal: { fontWeight: 500, fontSize: 54, lineHeight: 1.5, color: '#ffffff', active: '#ffffff' },
} as const;
export type CaptionStyleId = keyof typeof CAPTION_STYLES;

/** CSS font shorthand for `canvasMeasure` so lines are measured exactly as they are drawn. */
export const captionFont = (styleRef: string): string => {
  const s = CAPTION_STYLES[styleRef as CaptionStyleId] ?? CAPTION_STYLES.clean;
  return `${s.fontWeight} ${s.fontSize}px ${STAGE_FONT}`;
};

/**
 * 9:16 safe area (platform UI covers the top bar, the bottom caption and the like/share button column on the right,
 * about the right 15 % of the frame — so captions keep a wider right margin and sit slightly left of centre).
 */
export const SAFE = { side: 108, right: 162, top: 240, bottom: 360 };
const captionBoxWidth = (canvasWidth: number) => canvasWidth - SAFE.side - SAFE.right;
export const captionMaxWidth = (canvasWidth: number, styleRef = 'clean') =>
  captionBoxWidth(canvasWidth) - (styleRef === 'boxed' ? 32 : 0);

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
  box.style.cssText += `left:${SAFE.side}px;top:${centre - boxH / 2}px;width:${captionBoxWidth(width)}px;height:${boxH}px;`;
  inner.style.cssText += `font-family:${STAGE_FONT};font-weight:${s.fontWeight};font-size:${s.fontSize}px;line-height:${s.lineHeight};color:${s.color};text-align:center;-webkit-text-stroke:${Math.round(s.fontSize / 7)}px #000;paint-order:stroke fill;`;
  inner.style.setProperty('--active', s.active);
  inner.dataset.captionStyle = e.styleRef;
  if (e.styleRef === 'boxed' || e.styleRef === 'minimal') {
    inner.style.setProperty('-webkit-text-stroke', '0px');
  }
  if (e.styleRef === 'minimal') inner.style.textShadow = '0 0 2px #000000, 0 2px 6px #000000e6';
  if (e.styleRef === 'outline-bold') {
    inner.style.setProperty('-webkit-text-stroke', '12px #000000');
    inner.style.textShadow = '4px 4px 0 #7c3aed, -4px -4px 0 #7c3aed';
  }
  for (const line of e.lines) {
    const row = document.createElement('div');
    row.style.whiteSpace = 'nowrap';
    if (e.styleRef === 'boxed') {
      row.style.cssText +=
        'width:fit-content;max-width:100%;box-sizing:border-box;margin:0 auto;padding:0 16px;border-radius:16px;background:#111111dd;';
    }
    line.forEach((wi, k) => {
      const span = document.createElement('span');
      span.dataset.w = String(wi);
      span.textContent = e.words[wi]?.text ?? '';
      if (e.styleRef === 'pop-word') span.style.display = 'inline-block';
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
export function applyActiveWord(inner: HTMLElement, active: number, elapsed = 0) {
  const prev = inner.querySelector<HTMLElement>('[data-active]');
  const same = prev?.dataset.w === String(active);
  if (same && inner.dataset.captionStyle !== 'pop-word') return;
  if (prev && !same) {
    prev.removeAttribute('data-active');
    prev.style.color = '';
    prev.style.transform = '';
    prev.style.textDecoration = '';
  }
  if (active < 0) return;
  const el = inner.querySelector<HTMLElement>(`[data-w="${active}"]`);
  if (el) {
    el.dataset.active = '';
    el.style.color = 'var(--active)';
    if (inner.dataset.captionStyle === 'pop-word') {
      el.style.transform = `scale(${1 + 0.15 * (1 - Math.min(5, Math.max(0, elapsed)) / 5)})`;
    }
    if (inner.dataset.captionStyle === 'minimal') el.style.textDecoration = 'underline';
  }
}
