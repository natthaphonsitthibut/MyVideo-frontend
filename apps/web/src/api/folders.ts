import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

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
export type FolderSettings = Schemas['FolderSettings'];
export type FolderPlan = Schemas['FolderPlanResponse'];

/** The plan panel polls every 2 s while the edit is moving (no new infra: the run state is the truth). */
export function useFolderPlan(id: string) {
  return useQuery({
    queryKey: ['folders', id, 'plan'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/folders/{id}/plan', { params: { path: { id } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q) => {
      const p = q.state.data;
      if (!p) return 2000;
      const moving = p.steps.some((s) => s.state === 'running');
      return moving || (p.runId && !p.finished && !p.failed && !p.needs) ? 2000 : 5000;
    },
  });
}
export function useStartFolderEdit(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceIds: string[]) => {
      const { data, error, response } = await api.POST('/folders/{id}/edit', {
        params: { path: { id } },
        body: { sourceIds },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (data) => qc.setQueryData(['folders', id, 'plan'], data),
  });
}
export function useChooseFolderStyle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      styleId,
      styleIds,
      lockStyle,
    }: {
      styleId: string;
      styleIds: string[];
      lockStyle: boolean;
    }) => {
      const { data, error, response } = await api.POST('/folders/{id}/style', {
        params: { path: { id } },
        body: { styleId, styleIds, lockStyle },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (data) => qc.setQueryData(['folders', id, 'plan'], data),
  });
}
export function useUnlockEditingStyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await api.DELETE('/folders/style-lock');
      if (!r.response.ok) throw new ApiError(r.response.status, r.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] }),
  });
}

export function useUpdateFolder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title?: string; settings?: FolderSettings }) => {
      const { data, error, response } = await api.PATCH('/folders/{id}', { params: { path: { id } }, body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['folders', id], data);
      void qc.invalidateQueries({ queryKey: ['folders'], exact: true });
    },
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
