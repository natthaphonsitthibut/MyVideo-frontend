import { describe, expect, it } from 'vitest';
import { spriteCell, spriteStyle } from './sprite';

const idx = {
  version: 1,
  intervalSec: 1,
  cols: 10,
  rows: 10,
  tileWidth: 160,
  tileHeight: 90,
  count: 374,
  sheets: 4,
  durationMs: 373_005,
} as const;

describe('sprite math (mirrors backend spriteCell)', () => {
  it('maps seconds to sheet and offset', () => {
    expect(spriteCell(idx, 215.4)).toEqual({ index: 215, sheet: 2, x: 5 * 160, y: 1 * 90 });
    expect(spriteCell(idx, 999).index).toBe(373);
  });
  it('scales the sheet to the box', () => {
    expect(spriteStyle((n) => `/s/${n}`, idx, 13, 80)).toEqual({
      backgroundImage: 'url(/s/0)',
      backgroundPosition: '-240px -45px',
      backgroundSize: '800px 450px',
    });
  });
});
