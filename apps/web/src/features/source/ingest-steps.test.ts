import { describe, expect, it } from 'vitest';
import type { JobSummary } from '@/api/runs';
import { ingestProgress } from './ingest-steps';

const job = (type: string, status: JobSummary['status'], progress = 0) =>
  ({ type, status, progress }) as JobSummary;

describe('ingestProgress', () => {
  it('reports the running step and overall progress', () => {
    expect(ingestProgress([job('media.probe', 'succeeded', 1), job('media.proxy', 'running', 0.5)])).toEqual({
      label: 'ทำไฟล์พรีวิว',
      overall: 1.5 / 4,
    });
  });
  it('is done when all four steps succeeded', () => {
    const all = ['media.probe', 'media.proxy', 'media.audio', 'media.sprites'].map((t) =>
      job(t, 'succeeded', 1),
    );
    expect(ingestProgress(all)).toEqual({ label: 'เสร็จแล้ว', overall: 1 });
  });
  it('waits in queue before the first step', () => {
    expect(ingestProgress([])).toEqual({ label: 'รอคิว', overall: 0 });
  });
});
