import { expect, it } from 'vitest';
import { animationKeyframes } from './presets';

it('drops through the resting position before settling', () => {
  const frames = animationKeyframes('bounce', 'in');
  expect(frames[0]).toMatchObject({ opacity: 0, transform: 'translateY(-64px)' });
  expect(frames[1]).toMatchObject({ transform: 'translateY(12px)' });
  expect(frames.at(-1)).toMatchObject({ opacity: 1, transform: 'translateY(0)' });
});

it('zooms down while fading in and reverses for exit', () => {
  expect(animationKeyframes('zoom-in', 'in')).toEqual([
    { opacity: 0, transform: 'scale(1.3)' },
    { opacity: 1, transform: 'scale(1)' },
  ]);
  expect(animationKeyframes('zoom-in', 'out')[0]).toEqual({ opacity: 1, transform: 'scale(1)' });
  const exit = animationKeyframes('bounce', 'out');
  expect(exit.map((k) => k.offset ?? null)).toEqual([null, 0.35, null]);
  expect(animationKeyframes('unknown', 'in')).toEqual(animationKeyframes('fade', 'in'));
});
