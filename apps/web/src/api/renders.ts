import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_BASE_URL, ApiError, api, type Schemas } from './client';
import type { RunEvent } from './runs';

export type RenderSummary = Schemas['RenderSummary'];
export type RenderPreset = RenderSummary['preset'];

export const RENDERS_KEY = ['renders'] as const;
export const projectRendersKey = (projectId: string) => ['renders', 'project', projectId] as const;
const TERMINAL = new Set<RenderSummary['status']>(['ready', 'failed', 'cancelled']);
export const isActive = (r: RenderSummary) => !TERMINAL.has(r.status);

/**
 * Applies one event of the render's run to its summary (pure; unit-tested): job progress while it runs; the run
 * status changes queued → rendering; terminal states come from a refetch (the output columns decide "ready").
 */
export function applyRenderEvent(r: RenderSummary, ev: RunEvent): RenderSummary {
  if (ev.runId !== r.runId || !isActive(r)) return r;
  if (ev.kind === 'job') {
    if (ev.status !== 'running') return r;
    const progress = Math.max(r.progress, ev.progress ?? r.progress);
    if (r.status === 'rendering' && progress === r.progress) return r;
    return { ...r, status: 'rendering', progress };
  }
  if (ev.status === 'running' && r.status === 'queued') return { ...r, status: 'rendering' };
  return r;
}

/** `/api/renders/{id}/file` — authorised MP4; `download` adds Content-Disposition: attachment. */
export const renderFileUrl = (id: string, download = false) =>
  `${API_BASE_URL}/renders/${id}/file${download ? '?download=1' : ''}`;

function patchLists(qc: ReturnType<typeof useQueryClient>, next: RenderSummary) {
  const patch = (old: { items: RenderSummary[] } | undefined) => {
    if (!old) return old;
    const has = old.items.some((x) => x.id === next.id);
    return { items: has ? old.items.map((x) => (x.id === next.id ? next : x)) : [next, ...old.items] };
  };
  qc.setQueryData(projectRendersKey(next.projectId), patch);
  qc.setQueryData(RENDERS_KEY, patch);
}

export function useProjectRenders(projectId: string) {
  return useQuery({
    queryKey: projectRendersKey(projectId),
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects/{id}/renders', {
        params: { path: { id: projectId } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

export function useRenders() {
  return useQuery({
    queryKey: RENDERS_KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/renders');
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

/** Export (or retry): idempotent on the server per version + preset. */
export function useRequestRender(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { preset: RenderPreset; version?: number }) => {
      const { data, error, response } = await api.POST('/projects/{id}/renders', {
        params: { path: { id: projectId } },
        body,
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (r) => patchLists(qc, r),
  });
}

/**
 * Live progress of unfinished renders: one EventSource per active render's run; events patch the cached
 * summaries, and the stream's end refetches the render (final status, size, duration).
 */
export function useLiveRenders(renders: RenderSummary[] | undefined): void {
  const qc = useQueryClient();
  const active = (renders ?? [])
    .filter((r) => isActive(r) && r.runId)
    .map((r) => `${r.id}:${r.runId}`)
    .sort()
    .join(',');
  useEffect(() => {
    if (!active) return;
    const sources = active.split(',').map((pair) => {
      const [id, runId] = pair.split(':') as [string, string];
      const es = new EventSource(`${API_BASE_URL}/workflow-runs/${runId}/events`, { withCredentials: true });
      const onEvent = (e: MessageEvent<string>) => {
        const ev = JSON.parse(e.data) as RunEvent;
        const update = (old: { items: RenderSummary[] } | undefined) => {
          if (!old) return old;
          let changed = false;
          const items = old.items.map((x) => {
            if (x.id !== id) return x;
            const n = applyRenderEvent(x, ev);
            if (n !== x) changed = true;
            return n;
          });
          return changed ? { items } : old;
        };
        qc.setQueriesData<{ items: RenderSummary[] }>({ queryKey: RENDERS_KEY }, update);
      };
      es.addEventListener('job', onEvent);
      es.addEventListener('run', onEvent);
      es.addEventListener('end', async () => {
        es.close();
        const { data } = await api.GET('/renders/{id}', { params: { path: { id } } });
        if (data) patchLists(qc, data);
      });
      return es;
    });
    return () => {
      for (const es of sources) es.close();
    };
  }, [active, qc]);
}
