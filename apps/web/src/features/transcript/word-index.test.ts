import { describe, expect, it } from 'vitest';
import { buildWordIndex, findSegmentAt, findWordAt, searchSegments } from './word-index';

// Excerpt of the real transcript of the 45-min live S01 (dev DB, whisper.cpp large-v3-turbo, 2026-11-12)
const segs = [
  {
    seq: 0,
    startMs: 160,
    endMs: 3230,
    text: 'คลางห้องนอนนะ',
    words: [
      { text: 'คลาง', startMs: 160, endMs: 1200, kind: 'word' },
      { text: 'ห้องนอน', startMs: 1200, endMs: 2600, kind: 'word' },
      { text: 'นะ', startMs: 2600, endMs: 3230, kind: 'word' },
    ],
  },
  {
    seq: 1,
    startMs: 3230,
    endMs: 6000,
    text: 'ตัวนี้ 62 ยาว 27 นะ',
    words: [
      { text: 'ตัวนี้', startMs: 3230, endMs: 3900, kind: 'word' },
      { text: '62', startMs: 3900, endMs: 4300, kind: 'number' },
      { text: 'ยาว', startMs: 4300, endMs: 4800, kind: 'word' },
      { text: '27', startMs: 4800, endMs: 5400, kind: 'number' },
      { text: 'นะ', startMs: 5400, endMs: 6000, kind: 'word' },
    ],
  },
  {
    seq: 2,
    startMs: 9000,
    endMs: 11000,
    text: 'เป็น Woodstock นะคะ',
    words: [
      { text: 'เป็น', startMs: 9000, endMs: 9500, kind: 'word' },
      { text: 'Woodstock', startMs: 9500, endMs: 10400, kind: 'latin' },
      { text: 'นะคะ', startMs: 10400, endMs: 11000, kind: 'word' },
    ],
  },
];

describe('word index', () => {
  const idx = buildWordIndex(segs);

  it('numbers words globally in order and remembers their segment', () => {
    expect(idx.count).toBe(11);
    expect(idx.firstWord).toEqual([0, 3, 8]);
    expect(Array.from(idx.segOf)).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2]);
    expect(idx.starts[4]).toBe(3900);
  });

  it('finds the word being spoken at a time (start inclusive, end exclusive)', () => {
    expect(findWordAt(idx, 0)).toBe(-1); // before the first word
    expect(findWordAt(idx, 160)).toBe(0);
    expect(findWordAt(idx, 1199)).toBe(0);
    expect(findWordAt(idx, 1200)).toBe(1);
    expect(findWordAt(idx, 4000)).toBe(4);
    expect(findWordAt(idx, 7000)).toBe(-1); // silence between segments
    expect(findWordAt(idx, 10_999)).toBe(10);
    expect(findWordAt(idx, 11_000)).toBe(-1);
  });

  it('finds the segment at a time, or the last one before it during a pause', () => {
    expect(findSegmentAt(idx, 0)).toBe(0);
    expect(findSegmentAt(idx, 4000)).toBe(1);
    expect(findSegmentAt(idx, 7000)).toBe(1);
    expect(findSegmentAt(idx, 60_000)).toBe(2);
  });

  it('handles an empty transcript', () => {
    const empty = buildWordIndex([]);
    expect(findWordAt(empty, 1000)).toBe(-1);
    expect(findSegmentAt(empty, 1000)).toBe(-1);
  });
});

describe('searchSegments', () => {
  it('matches Thai text ignoring spaces and case, returns segment positions', () => {
    expect(searchSegments(segs, 'ห้องนอน')).toEqual([0]);
    expect(searchSegments(segs, 'ยาว 27')).toEqual([1]);
    expect(searchSegments(segs, 'ยาว27')).toEqual([1]);
    expect(searchSegments(segs, 'woodstock')).toEqual([2]);
    expect(searchSegments(segs, 'นะ')).toEqual([0, 1, 2]);
  });

  it('blank query → no matches', () => {
    expect(searchSegments(segs, '   ')).toEqual([]);
  });
});
