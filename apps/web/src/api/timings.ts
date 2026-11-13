import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type TimingList = Schemas['TimingList'];

const ACTIVE = new Set(['pending', 'running']);

/** Measured run durations; refreshes every 3 s while something is still running, otherwise on focus only. */
export function useTimings(limit = 50) {
  return useQuery({
    queryKey: ['timings', limit],
    queryFn: async (): Promise<TimingList> => {
      const { data, error, response } = await api.GET('/timings', { params: { query: { limit } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q) => (q.state.data?.items.some((r) => ACTIVE.has(r.status)) ? 3000 : false),
  });
}
export function useClearTimings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await api.DELETE('/timings');
      if (!r.data) throw new ApiError(r.response.status, r.error);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timings'] }),
  });
}
