import { describe, expect, it } from 'vitest';
import { applyRenderEvent, type RenderSummary } from './renders';
import type { RunEvent } from './runs';

const r: RenderSummary = {
  id: 'r1',
  projectId: 'p1',
  projectTitle: 'คลิป',
  projectVersion: 1,
  preset: 'standard',
  status: 'queued',
  progress: 0,
  runId: 'run1',
  error: null,
  sizeBytes: null,
  durationMs: null,
  createdAt: '2026-11-12T00:00:00.000Z',
  finishedAt: null,
};
const ev = (over: Partial<RunEvent>): RunEvent => ({
  id: '1',
  at: '2026-11-12T00:00:01.000Z',
  runId: 'run1',
  jobId: 'j1',
  kind: 'job',
  status: 'running',
  progress: 0.25,
  ...over,
});

describe('applyRenderEvent', () => {
  it('moves to rendering with the job progress', () => {
    expect(applyRenderEvent(r, ev({}))).toMatchObject({ status: 'rendering', progress: 0.25 });
    expect(applyRenderEvent(r, ev({ kind: 'run', jobId: null, progress: null }))).toMatchObject({
      status: 'rendering',
      progress: 0,
    });
  });

  it('never moves progress backwards and returns the same object when nothing changes', () => {
    const at50 = { ...r, status: 'rendering' as const, progress: 0.5 };
    expect(applyRenderEvent(at50, ev({ progress: 0.4 }))).toBe(at50);
    expect(applyRenderEvent(at50, ev({ progress: 0.6 })).progress).toBe(0.6);
  });

  it('ignores other runs, finished renders and non-running job states', () => {
    expect(applyRenderEvent(r, ev({ runId: 'other' }))).toBe(r);
    const ready = { ...r, status: 'ready' as const, progress: 1 };
    expect(applyRenderEvent(ready, ev({}))).toBe(ready);
    expect(applyRenderEvent(r, ev({ status: 'succeeded', progress: 1 }))).toBe(r);
  });
});
