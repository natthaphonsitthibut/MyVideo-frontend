import { expect, it } from 'vitest';
import { mediaKind } from './media-kind';

it('uses the probed kind first and filename only while metadata is pending', () => {
  expect(mediaKind({ kind: 'photo', originalFilename: 'renamed.mp4' })).toBe('photo');
  expect(mediaKind({ kind: 'video', originalFilename: 'renamed.png' })).toBe('video');
  expect(mediaKind({ kind: null, originalFilename: 'สินค้า.JPEG' })).toBe('photo');
  expect(mediaKind({ kind: null, originalFilename: 'live.mov' })).toBe('video');
});
