import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from './client';

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/folders');
      if (!data) throw new ApiError(response.status, error);
      return data.items;
    },
  });
}
export function useFolder(id: string) {
  return useQuery({
    queryKey: ['folders', id],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/folders/{id}', { params: { path: { id } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: 3000,
  });
}
export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error, response } = await api.POST('/folders', { body: { title } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}
export async function addFolderSources(id: string, sourceIds: string[]) {
  const { data, error, response } = await api.POST('/folders/{id}/sources', {
    params: { path: { id } },
    body: { sourceIds },
  });
  if (!data) throw new ApiError(response.status, error);
  return data;
}
export function useAddFolderSources(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceIds: string[]) => addFolderSources(id, sourceIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}
export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await api.DELETE('/folders/{id}', { params: { path: { id } } });
      if (!response.ok) throw new ApiError(response.status, error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}
