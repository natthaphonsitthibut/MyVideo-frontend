import { describe, expect, it } from 'vitest';
import { applyRunEvent, needsDetails, type RunList } from './runs';

const job = {
  id: 'j1',
  workflowRunId: 'r1',
  type: 'system.sleep',
  queue: 'media',
  stepIndex: 0,
  status: 'queued',
  attempts: 0,
  maxAttempts: 1,
  progress: 0,
  cancelRequested: false,
  error: null,
  runAfter: '',
  createdAt: '',
  startedAt: null,
  finishedAt: null,
} as const;
const list: RunList = {
  items: [
    {
      id: 'r1',
      kind: 'system_test',
      status: 'pending',
      subjectType: null,
      subjectId: null,
      createdAt: '',
      finishedAt: null,
      jobs: [job],
    },
  ],
  nextCursor: null,
};

describe('needsDetails', () => {
  const ev = (kind: 'job' | 'run', status: string) =>
    ({
      id: '1',
      kind,
      runId: 'r1',
      jobId: kind === 'job' ? 'j1' : null,
      status,
      progress: null,
      at: '',
    }) as const;
  it('asks for a refetch as soon as a job fails (events carry no error text)', () => {
    expect(needsDetails(list, ev('job', 'dead'))).toBe(true);
    expect(needsDetails(list, ev('job', 'failed'))).toBe(true);
  });
  it('not for progress, other statuses, or a job whose error is already cached', () => {
    expect(needsDetails(list, ev('job', 'running'))).toBe(false);
    expect(needsDetails(list, ev('run', 'failed'))).toBe(false); // the stream end refetches runs
    const withError: RunList = {
      ...list,
      items: list.items.map((r) => ({
        ...r,
        jobs: r.jobs.map((j) => ({
          ...j,
          error: { message: 'x', name: 'Error', fatal: true, attempt: 1, at: '' },
        })),
      })),
    } as RunList;
    expect(needsDetails(withError, ev('job', 'dead'))).toBe(false);
  });
});

describe('applyRunEvent', () => {
  it('updates job status and progress', () => {
    const next = applyRunEvent(list, {
      id: '5',
      kind: 'job',
      runId: 'r1',
      jobId: 'j1',
      status: 'running',
      progress: 0.4,
      at: '',
    });
    expect(next?.items[0]?.jobs[0]).toMatchObject({ status: 'running', progress: 0.4 });
    expect(list.items[0]?.jobs[0]?.status).toBe('queued'); // input not mutated
  });
  it('updates run status', () => {
    expect(
      applyRunEvent(list, {
        id: '6',
        kind: 'run',
        runId: 'r1',
        jobId: null,
        status: 'running',
        progress: null,
        at: '',
      })?.items[0]?.status,
    ).toBe('running');
  });
  it('returns the same object when nothing changes (no re-render)', () => {
    expect(
      applyRunEvent(list, {
        id: '7',
        kind: 'job',
        runId: 'other',
        jobId: 'x',
        status: 'running',
        progress: 1,
        at: '',
      }),
    ).toBe(list);
    expect(
      applyRunEvent(list, {
        id: '8',
        kind: 'job',
        runId: 'r1',
        jobId: 'j1',
        status: 'queued',
        progress: null,
        at: '',
      }),
    ).toBe(list);
  });
});
