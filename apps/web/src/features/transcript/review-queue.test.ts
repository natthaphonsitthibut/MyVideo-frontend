import { describe, expect, it } from 'vitest';
import { reviewSummary, reviewTargets, stepTarget } from './review-queue';

// words as the API returns them (S01a examples: พิม→พิมพ์, ควิก บู → Liquid Blue merged, ไซต์→ไซซ์ already checked)
const word = (text: string, extra: Record<string, unknown> = {}) => ({
  text,
  startMs: 0,
  endMs: 1,
  kind: 'word',
  original: null,
  aiFixed: false,
  heard: null,
  mergedInto: null,
  needsReview: false,
  ...extra,
});
const segments = [
  { seq: 4, words: [word('รับ'), word('พิมพ์', { aiFixed: true, heard: 'พิม', needsReview: true })] },
  { seq: 9, words: [word('ไซซ์', { aiFixed: true, heard: 'ไซต์' }), word('แอล')] },
  {
    seq: 12,
    words: [
      word('ของ'),
      word('Liquid Blue', { aiFixed: true, heard: 'ควิก บู', needsReview: true }),
      word('', { aiFixed: true, mergedInto: 1 }),
    ],
  },
];

describe('review queue', () => {
  it('lists the AI corrections still to check, in transcript order (a merged name once)', () => {
    expect(reviewTargets(segments)).toEqual([
      { seq: 4, index: 1, segment: 0, text: 'พิมพ์', heard: 'พิม' },
      { seq: 12, index: 1, segment: 2, text: 'Liquid Blue', heard: 'ควิก บู' },
    ]);
  });

  it('counts AI corrections and the ones still to check', () => {
    expect(reviewSummary(segments)).toEqual({ aiFixed: 3, toCheck: 2 });
  });

  it('steps forward/back and wraps; no current → first or last', () => {
    expect(stepTarget(2, null, 1)).toBe(0);
    expect(stepTarget(2, null, -1)).toBe(1);
    expect(stepTarget(2, 0, 1)).toBe(1);
    expect(stepTarget(2, 1, 1)).toBe(0);
    expect(stepTarget(2, 0, -1)).toBe(1);
    expect(stepTarget(0, null, 1)).toBeNull();
  });
});
