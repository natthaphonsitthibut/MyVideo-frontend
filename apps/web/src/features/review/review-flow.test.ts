import { describe, expect, it } from 'vitest';
import type { ReviewShot, ReviewVideoState } from '@/api/review-videos';
import { chosenRoles, parsePoints, reviewStep } from './review-flow';

const shot = (seq: number, role: ReviewShot['role'], chosenByMerchant = false): ReviewShot => ({
  sourceId: '00000000-0000-4000-8000-0000000000c5',
  seq,
  startMs: seq * 1000,
  endMs: seq * 1000 + 900,
  role,
  confidence: 0.5,
  reason: '',
  chosenByMerchant,
  needsChoice: !chosenByMerchant,
});
const state = (over: Partial<ReviewVideoState>): ReviewVideoState => ({
  runId: '00000000-0000-4000-8000-000000000001',
  status: 'running',
  templateId: 'review',
  sourceIds: [],
  product: { name: 'x', points: [] },
  result: null,
  error: null,
  ...over,
});

describe('review video flow', () => {
  it('steps: analysing → ready (with a project) | missing | failed', () => {
    expect(reviewStep(undefined)).toBe('analysing');
    expect(reviewStep(state({}))).toBe('analysing');
    expect(
      reviewStep(
        state({
          status: 'succeeded',
          result: { status: 'ready', projectId: shot(0, 'demo').sourceId, missing: [], shots: [] },
        }),
      ),
    ).toBe('ready');
    expect(
      reviewStep(
        state({
          status: 'succeeded',
          result: { status: 'missing', projectId: null, missing: [], shots: [] },
        }),
      ),
    ).toBe('missing');
    expect(reviewStep(state({ status: 'failed' }))).toBe('failed');
  });

  it('a retry sends only changed roles plus roles confirmed earlier', () => {
    const shots = [shot(0, 'demo'), shot(1, 'product_closeup', true), shot(2, 'broll')];
    const key = (s: number) => `${shots[0]?.sourceId}:${s}`;
    expect(chosenRoles(shots, { [key(0)]: 'unboxing', [key(2)]: 'broll' })).toEqual({
      [key(0)]: 'unboxing',
      [key(1)]: 'product_closeup',
    });
  });

  it('points: one per line, trimmed, max 4', () => {
    expect(parsePoints(' เงียบ \n\nเย็น\na\nb\nc')).toEqual(['เงียบ', 'เย็น', 'a', 'b']);
  });
});
