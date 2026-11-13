import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_BASE_URL, ApiError, api, type Schemas } from './client';
import { applyRunEvent, type RunEvent, type RunSummary } from './runs';

export type SourceSummary = Schemas['SourceSummary'];
export type SpriteIndex = NonNullable<SourceSummary['sprites']>;

export const SOURCES_KEY = ['sources'] as const;

/** Both the Library and project picker can reach older sources through the server's cursor. */
export function useLibrarySources() {
  return useInfiniteQuery({
    queryKey: [...SOURCES_KEY, 'pages'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await api.GET('/sources', {
        params: { query: { limit: 60, before: pageParam } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some((source) => source.status === 'processing'))
        ? 3000
        : false,
  });
}

export function useSources() {
  return useQuery({
    queryKey: SOURCES_KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/sources', { params: { query: { limit: 60 } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    // processing sources change server-side; poll gently while any is still processing
    refetchInterval: (q) => (q.state.data?.items.some((s) => s.status === 'processing') ? 3000 : false),
  });
}

/** Query options for one source; shared by `useSource` and lists that load several (`useQueries`). */
export function sourceQuery(id: string) {
  return {
    queryKey: [...SOURCES_KEY, id],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/sources/{id}', { params: { path: { id } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q: { state: { data?: SourceSummary } }) =>
      q.state.data?.status === 'processing' ? 3000 : false,
  } as const;
}

export function useSource(id: string) {
  return useQuery(sourceQuery(id));
}

/** One run with live updates over SSE while it is unfinished. */
export function useLiveRun(runId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['workflow-run', runId] as const,
    enabled: !!runId,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/workflow-runs/{id}', {
        params: { path: { id: runId ?? '' } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
  const done = query.data ? ['succeeded', 'failed', 'cancelled'].includes(query.data.status) : true;
  useEffect(() => {
    if (!runId || done) return;
    const key = ['workflow-run', runId] as const;
    const es = new EventSource(`${API_BASE_URL}/workflow-runs/${runId}/events`, { withCredentials: true });
    const onEvent = (e: MessageEvent<string>) => {
      const ev = JSON.parse(e.data) as RunEvent;
      qc.setQueryData<RunSummary>(key, (old) => {
        if (!old) return old;
        const patched = applyRunEvent({ items: [old], nextCursor: null }, ev);
        return patched?.items[0] ?? old;
      });
      // a new step appeared (pipeline advanced) or the run ended → refresh details
      if (ev.kind === 'run' || !qc.getQueryData<RunSummary>(key)?.jobs.some((j) => j.id === ev.jobId)) {
        void qc.invalidateQueries({ queryKey: key });
      }
    };
    es.addEventListener('job', onEvent);
    es.addEventListener('run', onEvent);
    es.addEventListener('end', () => {
      es.close();
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: SOURCES_KEY });
    });
    return () => es.close();
  }, [runId, done, qc]);
  return query;
}

/** Projects that would be deleted with the source (asked before the confirm dialog shows its text). */
export function useSourceDependents(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...SOURCES_KEY, id, 'dependents'],
    enabled,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/sources/{id}/dependents', {
        params: { path: { id } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

/** Deletes a source (and, when confirmed, the projects using it); refreshes the library and project lists. */
export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, withProjects }: { id: string; withProjects: boolean }) => {
      const { error, response } = await api.DELETE('/sources/{id}', {
        params: { path: { id }, query: { withProjects: withProjects ? 'true' : 'false' } },
      });
      if (!response.ok) throw new ApiError(response.status, error);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: SOURCES_KEY });
      await qc.invalidateQueries({ queryKey: ['projects'] });
      await qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export const assetUrl = (sourceId: string, kind: 'proxy' | 'peaks' | 'sprites' | 'original') =>
  `${API_BASE_URL}/sources/${sourceId}/assets/${kind}`;
export const spriteSheetUrl = (sourceId: string, sheet: number) =>
  `${API_BASE_URL}/sources/${sourceId}/sprites/${sheet}`;

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '–';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
