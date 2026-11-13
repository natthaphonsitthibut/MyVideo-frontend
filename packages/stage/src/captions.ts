import { wordGap } from './caption-layout';
import { STAGE_FONT } from './styles';
import type { StageElement } from './types';

type Caption = Extract<StageElement, { type: 'caption' }>;

/** Caption looks. Font size/line height drive both the builder's measure and the rendering (keep in sync). */
const LEGACY_STYLES = {
  clean: {
    fontWeight: 600,
    fontSize: 64,
    lineHeight: 1.5,
    color: '#ffffff',
    active: '#ffffff',
    emphasis: '#facc15',
  },
  'bold-highlight': {
    fontWeight: 800,
    fontSize: 68,
    lineHeight: 1.5,
    color: '#ffffff',
    active: '#facc15',
    emphasis: '#facc15',
  },
  'pop-word': {
    fontWeight: 900,
    fontSize: 76,
    lineHeight: 1.5,
    color: '#ffffff',
    active: '#facc15',
    emphasis: '#facc15',
  },
  boxed: {
    fontWeight: 600,
    fontSize: 60,
    lineHeight: 1.6,
    color: '#ffffff',
    active: '#facc15',
    emphasis: '#fb923c',
  },
  'outline-bold': {
    fontWeight: 900,
    fontSize: 72,
    lineHeight: 1.5,
    color: '#ffffff',
    active: '#67e8f9',
    emphasis: '#facc15',
  },
  // weight 500 + firm shadow: 400 with a soft shadow was hard to read on bright product colours (S01a renders)
  minimal: {
    fontWeight: 500,
    fontSize: 54,
    lineHeight: 1.5,
    color: '#ffffff',
    active: '#ffffff',
    emphasis: '#e7c58b',
  },
} as const;
export const CAPTION_STYLES = {
  ...LEGACY_STYLES,
  anchor: { ...LEGACY_STYLES.clean, active: '#ffffff' },
  karaoke: { ...LEGACY_STYLES['bold-highlight'], active: '#67e8f9' },
  'keyword-underline': { ...LEGACY_STYLES.clean, active: '#ffffff' },
  'stress-bounce': { ...LEGACY_STYLES['pop-word'] },
  'number-roll': { ...LEGACY_STYLES['outline-bold'] },
  'icon-pop': { ...LEGACY_STYLES['bold-highlight'] },
  'word-stack': { ...LEGACY_STYLES['pop-word'], fontSize: 64 },
  sticker: { ...LEGACY_STYLES['pop-word'], color: '#111111', active: '#111111' },
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
export function captionSafeArea(width: number, height: number) {
  if (height / width >= 1.6)
    return { side: width * 0.1, right: width * 0.15, top: height * 0.125, bottom: height * 0.1875 };
  return { side: width * 0.08, right: width * 0.08, top: height * 0.1, bottom: height * 0.18 };
}
// Layout also receives only width; retain the narrower portrait width so a ratio change never overflows.
const captionBoxWidth = (canvasWidth: number) => canvasWidth - canvasWidth * 0.25;
export const captionMaxWidth = (canvasWidth: number, styleRef = 'clean') =>
  // boxed: its padding; pop-word: room for the larger key word
  captionBoxWidth(canvasWidth) - (styleRef === 'boxed' ? 32 : styleRef === 'pop-word' ? 16 : 0);

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
  const safe = captionSafeArea(width, height);
  const lineH = s.fontSize * s.lineHeight;
  const boxH = e.lines.length * lineH;
  // centre at canvas centre + y, clamped so every line stays inside the safe area
  const centre = Math.min(
    Math.max(height / 2 + e.transform.y, safe.top + boxH / 2),
    height - safe.bottom - boxH / 2,
  );
  box.style.cssText += `left:${safe.side}px;top:${Math.floor(centre - boxH / 2)}px;width:${width - safe.side - safe.right}px;height:${boxH}px;`;
  inner.style.cssText += `font-family:${STAGE_FONT};font-weight:${s.fontWeight};font-size:${s.fontSize}px;line-height:${s.lineHeight};color:${s.color};text-align:center;-webkit-text-stroke:${Math.round(s.fontSize / 7)}px #000;paint-order:stroke fill;`;
  inner.style.setProperty('--active', s.active);
  inner.style.setProperty('--emphasis', s.emphasis);
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
    if (e.styleRef === 'boxed' || e.styleRef === 'sticker') {
      row.style.cssText +=
        'width:fit-content;max-width:100%;box-sizing:border-box;margin:0 auto;padding:0 16px;border-radius:16px;background:#111111dd;';
      if (e.styleRef === 'sticker')
        row.style.cssText += 'background:#facc15;box-shadow:6px 6px 0 #111111;border:4px solid #ffffff;';
    }
    line.forEach((wi, k) => {
      const span = document.createElement('span');
      span.setAttribute('style', '');
      span.dataset.w = String(wi);
      span.dataset.duration = String(
        Math.max(1, (e.words[wi]?.endFrame ?? 1) - (e.words[wi]?.startFrame ?? 0)),
      );
      span.textContent = e.words[wi]?.text ?? '';
      // pop-word lifts the spoken word (no sideways growth: Thai words touch, a scale would cover the neighbour)
      if (
        ['pop-word', 'stress-bounce', 'number-roll', 'icon-pop', 'word-stack', 'sticker'].includes(e.styleRef)
      )
        span.style.display = 'inline-block';
      if (e.styleRef === 'number-roll' && /\d/u.test(span.textContent)) span.dataset.number = '';
      if (e.styleRef === 'keyword-underline' && e.words[wi]?.emphasis) span.dataset.underline = '';
      if (e.styleRef === 'word-stack')
        span.style.cssText += 'display:inline-block;border-radius:8px;padding:0 0.04em;';
      if (e.words[wi]?.emphasis) {
        // the one key word may grow, so only it gets a little side room
        span.dataset.emphasis = '';
        span.style.cssText += 'display:inline-block;margin:0 0.05em;';
      }
      if (e.styleRef === 'icon-pop' && e.words[wi]?.emphasis) {
        span.style.position = 'relative';
        const icon = document.createElement('i');
        icon.dataset.captionIcon = '';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.cssText =
          'position:absolute;right:-0.25em;top:-0.15em;width:0.25em;height:0.25em;background:var(--emphasis);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);';
        span.appendChild(icon);
      }
      restWord(span);
      row.appendChild(span);
      if (k < line.length - 1) {
        const gap = wordGap(span.textContent, e.words[line[k + 1] as number]?.text ?? '');
        if (gap) row.appendChild(document.createTextNode(gap));
      }
    });
    inner.appendChild(row);
  }
}

const EMPHASIS_SCALE = 1.08;

/** A word's look when it is not the spoken one: plain, or the emphasis colour and size for the page's key word. */
function restWord(span: HTMLElement) {
  const key = span.dataset.emphasis !== undefined;
  span.style.color = key ? 'var(--emphasis)' : '';
  span.style.transform = key ? `scale(${EMPHASIS_SCALE})` : '';
  span.style.textDecoration = span.dataset.underline !== undefined ? 'underline' : '';
  span.style.backgroundColor = '';
  const icon = span.querySelector<HTMLElement>('[data-caption-icon]');
  if (icon) icon.style.transform = 'scale(0)';
}

/** Marks the spoken word (pure from the frame); the colour comes from the style's `--active`. */
export function applyActiveWord(inner: HTMLElement, active: number, elapsed = 0) {
  const code = inner.dataset.captionStyle ?? 'clean';
  if (
    [
      'anchor',
      'karaoke',
      'keyword-underline',
      'stress-bounce',
      'number-roll',
      'icon-pop',
      'word-stack',
      'sticker',
    ].includes(code)
  ) {
    for (const span of inner.querySelectorAll<HTMLElement>('[data-w]')) {
      restWord(span);
      span.removeAttribute('data-active');
      const index = Number(span.dataset.w);
      if (code === 'karaoke' && active >= 0 && index < active) span.style.color = 'var(--active)';
      if (index !== active || active < 0) continue;
      span.dataset.active = '';
      const key = span.dataset.emphasis !== undefined;
      span.style.color = key
        ? 'var(--emphasis)'
        : code === 'anchor' || code === 'keyword-underline'
          ? ''
          : 'var(--active)';
      const t = Math.min(1, Math.max(0, elapsed) / Math.min(8, Number(span.dataset.duration)));
      if (code === 'stress-bounce' && key)
        span.style.transform = `translateY(${-0.16 * Math.sin(Math.PI * t)}em) scale(${EMPHASIS_SCALE})`;
      // Move the real number as one glyph group. Never interpolate a fictitious price.
      if (code === 'number-roll' && span.dataset.number !== undefined)
        span.style.transform = `translateY(${(1 - t) * 0.22}em)${key ? ` scale(${EMPHASIS_SCALE})` : ''}`;
      if (code === 'word-stack') span.style.backgroundColor = '#111111dd';
      if (code === 'sticker')
        span.style.transform = `rotate(${-3 * (1 - t)}deg)${key ? ` scale(${EMPHASIS_SCALE})` : ''}`;
      const icon = span.querySelector<HTMLElement>('[data-caption-icon]');
      if (icon) icon.style.transform = `scale(${1 + (1 - t) * 0.2})`;
    }
    return;
  }
  const prev = inner.querySelector<HTMLElement>('[data-active]');
  const same = prev?.dataset.w === String(active);
  if (same && inner.dataset.captionStyle !== 'pop-word') return;
  if (prev && !same) {
    prev.removeAttribute('data-active');
    restWord(prev);
    prev.style.textDecoration = '';
  }
  if (active < 0) return;
  const el = inner.querySelector<HTMLElement>(`[data-w="${active}"]`);
  if (el) {
    el.dataset.active = '';
    // the key word keeps its own colour while spoken; the pop still plays on top of its size
    const key = el.dataset.emphasis !== undefined;
    el.style.color = key ? 'var(--emphasis)' : 'var(--active)';
    if (inner.dataset.captionStyle === 'pop-word') {
      const lift = Math.round(12 * (1 - Math.min(5, Math.max(0, elapsed)) / 5)) / 100;
      el.style.transform = `translateY(${-lift}em)${key ? ` scale(${EMPHASIS_SCALE})` : ''}`;
    }
    if (inner.dataset.captionStyle === 'minimal') el.style.textDecoration = 'underline';
  }
}
