/**
 * Dev-database sources the real-footage specs use (footage/MANIFEST.md). Titles are matched exactly: the 10-min
 * excerpt S01a ("ZXgMkBc01mI-10m-20m") shares the S01 video id, and specs that seek past 10 min need the
 * 45-min S01 itself.
 */
export const S01_TITLE = 'ZXgMkBc01mI-10m-55m.mp4';
export const S01A_TITLE = 'ZXgMkBc01mI-10m-20m';

export function readySource<T extends { title: string; status: string }>(
  items: T[],
  title: string,
): T | undefined {
  return items.find((s) => s.title === title && s.status === 'ready');
}
