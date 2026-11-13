import { describe, expect, it } from 'vitest';
import { autoRatio } from './auto-ratio';

const v = (width: number, height: number) => ({ width, height });

describe('autoRatio (majority orientation of the footage)', () => {
  it('picks 9:16 when most footage is portrait (live selling from a phone)', () => {
    expect(autoRatio([v(406, 720), v(720, 1280), v(1920, 1080)])).toBe('9:16');
  });
  it('picks 16:9 when most footage is landscape', () => {
    expect(autoRatio([v(1920, 1080), v(1280, 720), v(406, 720)])).toBe('16:9');
  });
  it('picks 1:1 when most footage is square', () => {
    expect(autoRatio([v(1080, 1080), v(1080, 1080), v(406, 720)])).toBe('1:1');
  });
  it('treats near-square (within 5 %) as square and 4:5 as portrait', () => {
    expect(autoRatio([v(1000, 1040)])).toBe('1:1');
    expect(autoRatio([v(576, 720)])).toBe('9:16');
  });
  it('breaks ties and empty sets toward 9:16 (short-video platforms)', () => {
    expect(autoRatio([v(406, 720), v(1920, 1080)])).toBe('9:16');
    expect(autoRatio([])).toBe('9:16');
  });
  it('ignores footage not probed yet', () => {
    expect(autoRatio([{ width: null, height: null }, v(1920, 1080)])).toBe('16:9');
  });
});
