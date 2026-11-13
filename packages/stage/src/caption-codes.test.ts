// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { applyActiveWord, buildCaptionNode, CAPTION_STYLES } from './captions';
import type { StageElement } from './types';

const codes = [
  'anchor',
  'karaoke',
  'keyword-underline',
  'stress-bounce',
  'number-roll',
  'icon-pop',
  'word-stack',
  'sticker',
];
it.each(codes)('%s preserves real words and gives deterministic backward seeks', (styleRef) => {
  expect(styleRef in CAPTION_STYLES).toBe(true);
  const inner = document.createElement('div'),
    box = document.createElement('div');
  const e = {
    type: 'caption',
    id: 'c',
    trackId: 't',
    origin: 'ai',
    startFrame: 0,
    durationFrames: 30,
    styleRef,
    words: [
      { text: 'ราคา 199 บาท', startFrame: 0, endFrame: 15, emphasis: true },
      { text: 'ค่ะ', startFrame: 15, endFrame: 30 },
    ],
    lines: [[0, 1]],
    transform: { x: 0, y: 560, scale: 1, rotation: 0 },
  } as StageElement & { type: 'caption' };
  buildCaptionNode(box, inner, e, 1080, 1920);
  const text = inner.textContent;
  applyActiveWord(inner, 0, 0);
  const initial = inner.innerHTML;
  applyActiveWord(inner, 1, 0);
  applyActiveWord(inner, 0, 0);
  expect(inner.innerHTML).toBe(initial);
  expect(inner.textContent).toBe(text);
  applyActiveWord(inner, -1);
  expect(inner.querySelector('[data-active]')).toBeNull();
});
it.each([
  [1920, 1080],
  [1080, 1080],
  [1080, 1350],
])('keeps a caption fully in the %sx%s safe area', (width, height) => {
  const inner = document.createElement('div'),
    box = document.createElement('div');
  buildCaptionNode(
    box,
    inner,
    {
      type: 'caption',
      id: 'c',
      trackId: 't',
      origin: 'ai',
      startFrame: 0,
      durationFrames: 30,
      styleRef: 'anchor',
      words: [
        { text: 'ราคา', startFrame: 0, endFrame: 15 },
        { text: '199 บาทค่ะ', startFrame: 15, endFrame: 30 },
      ],
      lines: [[0], [1]],
      transform: { x: 0, y: 560, scale: 1, rotation: 0 },
    },
    width,
    height,
  );
  expect(parseFloat(box.style.top) + parseFloat(box.style.height)).toBeLessThanOrEqual(height * 0.82);
  expect(parseFloat(box.style.width)).toBeGreaterThan(width * 0.7);
});
