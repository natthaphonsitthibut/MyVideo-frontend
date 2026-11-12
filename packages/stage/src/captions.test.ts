// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { canvasMeasure, layoutLines, lineText } from './caption-layout';
import { applyActiveWord, buildCaptionNode, CAPTION_STYLES, captionFont, captionMaxWidth } from './captions';
import type { StageElement } from './types';

afterEach(() => vi.restoreAllMocks());

function styledCaption(styleRef: string) {
  const box = document.createElement('div');
  const inner = document.createElement('div');
  const words = [
    { text: 'ขาย', startFrame: 0, endFrame: 12 },
    { text: 'ดี', startFrame: 12, endFrame: 20 },
  ];
  buildCaptionNode(
    box,
    inner,
    {
      type: 'caption',
      id: 'c',
      trackId: 't',
      origin: 'ai',
      startFrame: 0,
      durationFrames: 20,
      styleRef,
      words,
      lines: [[0, 1]],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    },
    1080,
    1920,
  );
  return { box, inner, words };
}

it.each([
  ['pop-word', 900, 76, 1.5],
  ['boxed', 600, 60, 1.6],
  ['outline-bold', 900, 72, 1.5],
  ['minimal', 500, 54, 1.5],
])('measures and draws %s with the same typography', (id, weight, size, height) => {
  const { inner, words } = styledCaption(String(id));
  expect(inner.style.fontWeight).toBe(String(weight));
  expect(inner.style.fontSize).toBe(`${size}px`);
  expect(inner.style.lineHeight).toBe(String(height));
  const context = { font: '', measureText: (text: string) => ({ width: text.length * 100 }) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
  const measure = canvasMeasure(captionFont(String(id)));
  const lines = layoutLines(words, measure, captionMaxWidth(1080, String(id)));
  const normalized = document.createElement('span');
  normalized.style.font = context.font;
  expect(normalized.style.fontFamily).toBe(inner.style.fontFamily);
  expect(normalized.style.fontSize).toBe(inner.style.fontSize);
  expect(normalized.style.fontWeight).toBe(inner.style.fontWeight);
  expect(inner.textContent).toBe(lineText(words, lines[0]!));
  if (id === 'boxed') {
    expect(captionMaxWidth(1080, String(id))).toBe(778);
    expect(inner.firstElementChild?.getAttribute('style')).toContain('padding');
  }
});

it('pops the spoken word from its frame, including backward seeks and clearing', () => {
  const { inner } = styledCaption('pop-word');
  applyActiveWord(inner, 0, 0);
  const word = inner.querySelector<HTMLElement>('[data-w="0"]')!;
  expect(word.style.transform).toBe('scale(1.1)');
  applyActiveWord(inner, 0, 5);
  expect(word.style.transform).toBe('scale(1)');
  applyActiveWord(inner, 0, 0);
  expect(word.style.transform).toBe('scale(1.1)');
  applyActiveWord(inner, 1, 0);
  expect(word.style.transform).toBe('');
  applyActiveWord(inner, -1);
  expect(inner.querySelector('[data-active]')).toBeNull();
});

it('draws the emphasis word in the emphasis colour, larger, and keeps it after the active word moves on', () => {
  const box = document.createElement('div');
  const inner = document.createElement('div');
  buildCaptionNode(
    box,
    inner,
    {
      type: 'caption',
      id: 'c',
      trackId: 't',
      origin: 'ai',
      startFrame: 0,
      durationFrames: 20,
      styleRef: 'pop-word',
      words: [
        { text: 'ราคา 80 บาท', startFrame: 0, endFrame: 12, emphasis: true },
        { text: 'ค่ะ', startFrame: 12, endFrame: 20 },
      ],
      lines: [[0, 1]],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    },
    1080,
    1920,
  );
  const key = inner.querySelector<HTMLElement>('[data-w="0"]')!;
  expect(key.dataset.emphasis).toBe('');
  expect(key.style.color).toBe('var(--emphasis)');
  expect(key.style.transform).toBe('scale(1.08)');
  expect(inner.style.getPropertyValue('--emphasis')).toBe(CAPTION_STYLES['pop-word'].emphasis);
  applyActiveWord(inner, 0, 0);
  applyActiveWord(inner, 1, 0);
  expect(key.style.color).toBe('var(--emphasis)');
  expect(key.style.transform).toBe('scale(1.08)');
});

it('keeps captions clear of the right-hand platform buttons (right 15 % of a 9:16 frame)', () => {
  const { box } = styledCaption('clean');
  const left = Number.parseFloat(box.style.left);
  const right = left + Number.parseFloat(box.style.width);
  expect(left).toBe(108);
  expect(right).toBeLessThanOrEqual(1080 * 0.85);
  // lines are laid out for exactly the box width, so a full line never reaches the buttons either
  expect(captionMaxWidth(1080)).toBe(right - left);
});

it('wraps before the boxed padding would cross the safe area', () => {
  const { words } = styledCaption('boxed');
  // 5 characters: 800 px fits the plain width (810), not the boxed one (810 − 32)
  const measure = (text: string) => text.length * 160;
  expect(layoutLines(words, measure, captionMaxWidth(1080))).toEqual([[0, 1]]);
  expect(layoutLines(words, measure, captionMaxWidth(1080, 'boxed'))).toEqual([[0], [1]]);
});

it.each([
  ['clean', '600', '64px', '#ffffff'],
  ['bold-highlight', '800', '68px', '#facc15'],
])('preserves the existing %s typography and active colour', (id, weight, size, active) => {
  const { inner } = styledCaption(id);
  expect(inner.style.fontWeight).toBe(weight);
  expect(inner.style.fontSize).toBe(size);
  expect(inner.style.lineHeight).toBe('1.5');
  expect(inner.style.getPropertyValue('--active')).toBe(active);
  applyActiveWord(inner, 0, 0);
  expect(inner.querySelector<HTMLElement>('[data-active]')!.style.transform).toBe('');
  expect(inner.firstElementChild?.getAttribute('style')).toBe('white-space: nowrap;');
});

it('keeps minimal captions unstroked and underlines only the active word', () => {
  const { inner } = styledCaption('minimal');
  expect(inner.style.getPropertyValue('-webkit-text-stroke')).not.toContain('7px');
  applyActiveWord(inner, 0);
  expect(inner.querySelector<HTMLElement>('[data-active]')!.style.textDecoration).toBe('underline');
});

it.each([
  [['ขาย', 'ราคา', 'นี้', 'ครับผม'], 'ขายราคานี้ครับผม', [0, 3, 7, 10]],
  [['รับ', 'พิม', 'น้ำ', 'มา', '100', 'บาท'], 'รับพิมน้ำมา 100 บาท', [0, 3, 6, 9, 12, 16]],
])('renders %j with the measured text and exact karaoke word boundaries', (tokens, expected, offsets) => {
  const measured: string[] = [];
  // jsdom has no canvas implementation; capture the actual strings sent to the browser API.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText(text: string) {
      measured.push(text);
      return { width: text.length * 10 };
    },
  } as CanvasRenderingContext2D);
  const words = tokens.map((text, i) => ({ text, startFrame: i, endFrame: i + 1 }));
  const lines = layoutLines(words, canvasMeasure('600 64px sans-serif'), 2000);
  const caption: Extract<StageElement, { type: 'caption' }> = {
    type: 'caption',
    id: 'caption',
    trackId: 'captions',
    origin: 'ai',
    startFrame: 0,
    durationFrames: tokens.length,
    words,
    lines,
    styleRef: 'bold-highlight',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  };
  const box = document.createElement('div');
  const inner = document.createElement('div');
  buildCaptionNode(box, inner, caption, 1080, 1920);
  expect(measured.at(-1)).toBe(expected);
  expect(inner.textContent).toBe(expected);
  expect(inner.textContent).toBe(lineText(words, lines[0] ?? []));
  const row = inner.firstElementChild!;
  for (let i = 0; i < tokens.length; i++) {
    applyActiveWord(inner, i);
    const active = inner.querySelector('[data-active]')!;
    expect(active.textContent).toBe(tokens[i]);
    expect(inner.querySelectorAll('[data-active]')).toHaveLength(1);
    const prefix = document.createRange();
    prefix.setStart(row, 0);
    prefix.setEndBefore(active);
    expect(prefix.toString().length).toBe(offsets[i]);
  }
  applyActiveWord(inner, -1);
  expect(inner.querySelector('[data-active]')).toBeNull();
});
