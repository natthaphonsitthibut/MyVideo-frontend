import type { SpriteIndex } from '@/api/sources';

/** Same math as backend `spriteCell` (domain lib): tile i = frame at second i. */
export function spriteCell(idx: SpriteIndex, t: number) {
  const index = Math.max(0, Math.min(idx.count - 1, Math.floor(t / idx.intervalSec)));
  const perSheet = idx.cols * idx.rows;
  const within = index % perSheet;
  const col = within % idx.cols;
  const row = Math.floor(within / idx.cols);
  return { index, sheet: Math.floor(index / perSheet), x: col * idx.tileWidth, y: row * idx.tileHeight };
}

/** CSS background for showing the tile at time t scaled to a box of `width` px. */
export function spriteStyle(
  sourceUrl: (sheet: number) => string,
  idx: SpriteIndex,
  t: number,
  width: number,
) {
  const c = spriteCell(idx, t);
  const scale = width / idx.tileWidth;
  return {
    backgroundImage: `url(${sourceUrl(c.sheet)})`,
    backgroundPosition: `${-c.x * scale}px ${-c.y * scale}px`,
    backgroundSize: `${idx.cols * idx.tileWidth * scale}px ${idx.rows * idx.tileHeight * scale}px`,
  };
}
