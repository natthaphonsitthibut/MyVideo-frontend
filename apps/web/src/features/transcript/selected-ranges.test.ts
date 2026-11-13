import { expect, it } from 'vitest';
import { parseRangeTime, selectedRanges } from './selected-ranges';

it('accepts minutes or hours and preserves milliseconds without clock wraparound', () => {
  expect(parseRangeTime('02:30.125')).toBe(150125);
  expect(parseRangeTime('1:02:03')).toBe(3723000);
  expect(parseRangeTime('90:00')).toBe(5400000);
  for (const bad of ['', '-1:00', '2:60', 'hello', '1:99:00']) expect(parseRangeTime(bad)).toBeNull();
});
it('validates every range before submitting; disjoint choices never include the gaps', () => {
  expect(
    selectedRanges(
      [
        { start: '0:10', end: '0:20' },
        { start: '0:40', end: '0:50' },
      ],
      60000,
    ),
  ).toEqual([
    { startMs: 10000, endMs: 20000 },
    { startMs: 40000, endMs: 50000 },
  ]);
  expect(() =>
    selectedRanges(
      [
        { start: '0:10', end: '0:30' },
        { start: '0:20', end: '0:40' },
      ],
      60000,
    ),
  ).toThrow();
  expect(() => selectedRanges([{ start: '0:10', end: '1:10' }], 60000)).toThrow();
});
