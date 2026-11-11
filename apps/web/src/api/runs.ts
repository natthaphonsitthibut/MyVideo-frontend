import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, ApiError, api, type Schemas } from './client';

export type RunSummary = Schemas['RunSummary'];
export type JobSummary = Schemas['JobSummary'];
export type RunList = Schemas['RunList'];
export type RunEvent = Schemas['RunEvent'];

export const RUNS_KEY = ['workflow-runs'] as const;
const TERMINAL_RUN = new Set(['succeeded', 'failed', 'cancelled']);

/** Applies one SSE event to the cached list (pure; unit-tested). Unknown runs/jobs are ignored. */
export function applyRunEvent(list: RunList | undefined, ev: RunEvent): RunList | undefined {
  if (!list) return list;
  let changed = false;
  const items = list.items.map((run) => {
    if (run.id !== ev.runId) return run;
    if (ev.kind === 'run') {
      if (run.status === ev.status) return run;
      changed = true;
      return { ...run, status: ev.status as RunSummary['status'] };
    }
    let jobChanged = false;
    const jobs = run.jobs.map((j) => {
      if (j.id !== ev.jobId) return j;
      const status = ev.status as JobSummary['status'];
      const progress = ev.progress ?? j.progress;
      if (j.status === status && j.progress === progress) return j;
      jobChanged = true;
      return { ...j, status, progress };
    });
    if (!jobChanged) return run;
    changed = true;
    return { ...run, jobs };
  });
  return changed ? { ...list, items } : list;
}

async function fetchRuns(): Promise<RunList> {
  const { data, error, response } = await api.GET('/workflow-runs', { params: { query: { limit: 20 } } });
  if (!data) throw new ApiError(response.status, error);
  return data;
}

export function useRuns() {
  return useQuery({ queryKey: RUNS_KEY, queryFn: fetchRuns, refetchInterval: 30_000 });
}

/**
 * Live progress: one EventSource per unfinished run in the list. Events patch the cache; when a run ends the
 * list is refetched once for final details (attempts, errors).
 */
export function useLiveRuns(list: RunList | undefined): void {
  const qc = useQueryClient();
  // bumps after a stream ends so a run that is still active (e.g. retried meanwhile) gets a fresh stream
  const [epoch, setEpoch] = useState(0);
  const activeIds = useMemo(
    () =>
      (list?.items ?? [])
        .filter((r) => !TERMINAL_RUN.has(r.status))
        .map((r) => r.id)
        .sort()
        .join(','),
    [list],
  );
  const streamKey = activeIds ? `${activeIds}|${epoch}` : '';
  useEffect(() => {
    if (!streamKey) return;
    const ids = streamKey.split('|')[0]?.split(',') ?? [];
    const sources = ids.map((id) => {
      const es = new EventSource(`${API_BASE_URL}/workflow-runs/${id}/events`, { withCredentials: true });
      const onEvent = (e: MessageEvent<string>) => {
        const ev = JSON.parse(e.data) as RunEvent;
        qc.setQueryData<RunList>(RUNS_KEY, (old) => applyRunEvent(old, ev));
      };
      es.addEventListener('job', onEvent);
      es.addEventListener('run', onEvent);
      es.addEventListener('end', () => {
        es.close();
        void qc.invalidateQueries({ queryKey: RUNS_KEY }).then(() => setEpoch((n) => n + 1));
      });
      return es;
    });
    return () => {
      for (const es of sources) es.close();
    };
  }, [streamKey, qc]);
}

function invalidate(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: RUNS_KEY });
}

export function useCreateTestRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { ms: number; steps: number; failFirstAttempt: boolean }) => {
      const { data, error, response } = await api.POST('/workflow-runs/test', { body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useJobAction(action: 'cancel' | 'retry') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res =
        action === 'cancel'
          ? await api.POST('/jobs/{id}/cancel', { params: { path: { id: jobId } } })
          : await api.POST('/jobs/{id}/retry', { params: { path: { id: jobId } } });
      if (!res.data) throw new ApiError(res.response.status, res.error);
      return res.data;
    },
    onSettled: () => invalidate(qc),
  });
}
