import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from './client';
export function useReferenceStyles() {
  return useQuery({
    queryKey: ['reference-styles'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/reference-styles');
      if (!data) throw new ApiError(response.status, error);
      return data.items;
    },
    refetchInterval: (q) =>
      q.state.data?.some((r) => r.status === 'waiting' || r.status === 'processing') ? 2000 : false,
  });
}
export function useCreateReferenceStyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { sourceId: string; title: string }) => {
      const { data, error, response } = await api.POST('/reference-styles', { body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reference-styles'] });
      await qc.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
export function useReferenceAction(action: 'retry' | 'lock') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } =
        action === 'retry'
          ? await api.POST('/reference-styles/{id}/retry', { params: { path: { id } } })
          : await api.POST('/reference-styles/{id}/lock', { params: { path: { id } } });
      if (!response.ok) throw new ApiError(response.status, error);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reference-styles'] });
      await qc.invalidateQueries({ queryKey: ['folders'] });
      await qc.invalidateQueries({ queryKey: ['folder-plan'] });
      await qc.invalidateQueries({ queryKey: ['style-packs'] });
    },
  });
}
