import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

const key = (id: string) => ['selected-transcript-clips', id];
export function useSelectedClips(id: string) {
  return useQuery({
    queryKey: key(id),
    queryFn: async () => {
      const r = await api.GET('/sources/{id}/transcript/clips', { params: { path: { id } } });
      if (!r.data) throw new ApiError(r.response.status, r.error);
      return r.data;
    },
    refetchInterval: (q) =>
      q.state.data?.clips.some(
        (c) => c.status === 'pending' || c.status === 'running' || c.sourceStatus === 'processing',
      )
        ? 2000
        : false,
  });
}
export function useStartSelectedClips(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['SelectedClipsBody']) => {
      const r = await api.POST('/sources/{id}/transcript/clips', { params: { path: { id } }, body });
      if (!r.data) throw new ApiError(r.response.status, r.error);
      return r.data;
    },
    onSuccess: (data) => qc.setQueryData(key(id), data),
  });
}
