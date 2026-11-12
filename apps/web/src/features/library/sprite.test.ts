import { describe, expect, it } from 'vitest';
import { spriteCell, spriteCoverStyle, spriteStyle } from './sprite';

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
  it('covers a box of another shape with exactly one tile, centred', () => {
    // 9:16 box 96×(96*16/9): scale = box height / tile height; the tile is wider than the box → centred crop
    const h = (96 * 16) / 9;
    const s = h / 90;
    const st = spriteCoverStyle((n) => `/s/${n}`, idx, 13, 96, h);
    expect(st.backgroundImage).toBe('url(/s/0)');
    expect(st.backgroundSize).toBe(`${1600 * s}px ${900 * s}px`);
    expect(st.backgroundPosition).toBe(`${-3 * 160 * s + (96 - 160 * s) / 2}px ${-1 * 90 * s}px`);
    // a box wider than the tile's shape scales by width and centres vertically
    const wide = spriteCoverStyle((n) => `/s/${n}`, idx, 0, 320, 90);
    expect(wide.backgroundSize).toBe('3200px 1800px');
    expect(wide.backgroundPosition).toBe(`0px ${(90 - 180) / 2}px`);
  });
});
