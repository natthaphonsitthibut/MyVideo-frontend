import { describe, expect, it } from 'vitest';
import { clipsActive } from '@/api/clips';
import { rulesReason } from './labels';

describe('rulesReason', () => {
  it('turns the first three rule signals into Thai, keeping the counts', () => {
    // a real rules-mode reason from the S01 eval run (docs/eval/highlights-rerank-2026-11-12.md)
    const r =
      'price ×3 (80 บาท) · cta ×3 (สั่ง, รับพิม) · detail ×7 (ยาว, ลาย, ไซต์) · complete ×1 (price/cta/detail/benefit)';
    expect(rulesReason(r)).toBe('ราคา ×3 · บอกวิธีสั่ง ×3 · รายละเอียดสินค้า ×7');
  });
});

describe('clipsActive', () => {
  it('polls only while the run is pending or running', () => {
    const s = (status: 'none' | 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled') => ({
      runId: null,
      status,
      mode: null,
      clips: [],
    });
    expect(clipsActive(s('pending'))).toBe(true);
    expect(clipsActive(s('running'))).toBe(true);
    expect(clipsActive(s('succeeded'))).toBe(false);
    expect(clipsActive(s('failed'))).toBe(false);
    expect(clipsActive(undefined)).toBe(false);
  });
});
