// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { canvasMeasure, layoutLines, lineText } from './caption-layout';
import { applyActiveWord, buildCaptionNode } from './captions';
import type { StageElement } from './types';

afterEach(() => vi.restoreAllMocks());

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
