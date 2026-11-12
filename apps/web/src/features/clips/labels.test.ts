import { describe, expect, it } from 'vitest';
import { clipsActive } from '@/api/clips';
import { clipHeading, clipsPanelView, rulesReason } from './labels';

describe('clipHeading', () => {
  const clip = {
    status: 'planned' as const,
    title: 'source-file',
    type: 'faq',
    rank: 2,
    startMs: 1000,
    endMs: 22500,
  };

  it('uses the Thai type, rank and rounded duration before building', () => {
    expect(clipHeading(clip)).toBe('ถาม-ตอบ ช่วงที่ 2 · 22 วิ');
    expect(clipHeading({ ...clip, type: 'unknown' })).toBe('ช่วงขายของ ช่วงที่ 2 · 22 วิ');
  });

  it('uses the real title once built', () => {
    expect(clipHeading({ ...clip, status: 'ready', title: 'วิธีสั่งสินค้า' })).toBe('วิธีสั่งสินค้า');
  });
});

describe('clipsPanelView', () => {
  it('waits for the first clips response before showing any content', () => {
    expect(clipsPanelView(true, 'pending', false)).toBe('loading');
  });

  it('shows content after a response and retains it during background requests', () => {
    expect(clipsPanelView(true, 'success', true)).toBe('content');
    expect(clipsPanelView(true, 'pending', true)).toBe('content');
    expect(clipsPanelView(true, 'error', true)).toBe('content');
  });

  it('does not show the creation form when the initial request fails', () => {
    expect(clipsPanelView(true, 'error', false)).toBe('error');
  });

  it('does not wait for a disabled clips query before transcription is ready', () => {
    expect(clipsPanelView(false, 'pending', false)).toBe('transcript');
  });
});

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
      phase: 'none' as const,
      styleId: null,
      advice: null,
      clips: [],
    });
    expect(clipsActive(s('pending'))).toBe(true);
    expect(clipsActive(s('running'))).toBe(true);
    expect(clipsActive(s('succeeded'))).toBe(false);
    expect(clipsActive(s('failed'))).toBe(false);
    expect(clipsActive(undefined)).toBe(false);
  });
});
