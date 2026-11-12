import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type ClipsState = Schemas['ClipsState'];
export type ClipSuggestion = Schemas['ClipSuggestion'];
export type ProjectSummary = Schemas['ProjectSummary'];

const clipsKey = (sourceId: string) => ['clips', sourceId] as const;

/** Whether a run is still producing cards (the page keeps polling then). */
export const clipsActive = (s: ClipsState | undefined) => s?.status === 'pending' || s?.status === 'running';

/** Clip suggestions of the newest run; polls every 2 s while it runs, so cards appear as each clip is built. */
export function useClips(sourceId: string, enabled = true) {
  return useQuery({
    queryKey: clipsKey(sourceId),
    enabled,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/sources/{id}/clips', {
        params: { path: { id: sourceId } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q) => (clipsActive(q.state.data) ? 2000 : false),
  });
}

export function useGenerateClips(sourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { productName?: string; fresh?: boolean }) => {
      const { data, error, response } = await api.POST('/sources/{id}/clips', {
        params: { path: { id: sourceId } },
        body,
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (state) => qc.setQueryData(clipsKey(sourceId), state),
  });
}

export function useDiscardClip(sourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error, response } = await api.POST('/clip-suggestions/{id}/discard', {
        params: { path: { id } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (gone) =>
      qc.setQueryData<ClipsState>(clipsKey(sourceId), (old) =>
        old ? { ...old, clips: old.clips.filter((c) => c.id !== gone.id) } : old,
      ),
  });
}

export type StylePack = Schemas['StylePackSummary'];

/** Edit styles (static list from the server; Thai names). */
export function useStylePacks(enabled = true) {
  return useQuery({
    queryKey: ['style-packs'],
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/style-packs');
      if (!data) throw new ApiError(response.status, error);
      return data.items;
    },
  });
}

/** Starts a restyle run (rebuild with another style, no AI call); resolves with the run id. */
export function useRestyle(projectId: string) {
  return useMutation({
    mutationFn: async (styleId: string) => {
      const { data, error, response } = await api.POST('/projects/{id}/restyle', {
        params: { path: { id: projectId } },
        body: { styleId },
      });
      if (!data) throw new ApiError(response.status, error);
      return data.runId;
    },
  });
}

/** One workflow run, polled every second until it ends. */
export function useRunStatus(runId: string | null) {
  return useQuery({
    queryKey: ['workflow-run', runId],
    enabled: runId !== null,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/workflow-runs/{id}', {
        params: { path: { id: runId ?? '' } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q) =>
      q.state.data && ['succeeded', 'failed', 'cancelled'].includes(q.state.data.status) ? false : 1000,
  });
}

/** Message of a refused API call (server messages for merchants are Thai). */
export function apiErrorMessage(err: unknown): string | null {
  if (!err) return null;
  const body = err instanceof ApiError ? err.body : null;
  const msg =
    body && typeof body === 'object' && 'message' in body ? (body as { message: unknown }).message : null;
  return typeof msg === 'string' ? msg : err instanceof Error ? err.message : 'error';
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects');
      if (!data) throw new ApiError(response.status, error);
      return data.items;
    },
  });
}

/** Thai labels for the clip types the analysis returns. */
export const CLIP_TYPE_LABEL: Record<string, string> = {
  'product-intro': 'แนะนำสินค้า',
  demo: 'สาธิต',
  'price-promo': 'ราคา/โปร',
  faq: 'ถาม-ตอบ',
  testimonial: 'รีวิว',
  other: 'ช่วงขายของ',
};
