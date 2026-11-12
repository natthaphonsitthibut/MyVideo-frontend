import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type ProjectRecord = Schemas['ProjectRecord'];

export const projectKey = (id: string) => ['project', id] as const;

/** The current version of a project. */
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKey(id),
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects/{id}', { params: { path: { id } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

export type ProjectVersionSummary = Schemas['ProjectVersionSummary'];

/** All saved versions, newest first (E09-F10). */
export function useProjectVersions(id: string) {
  return useQuery({
    queryKey: ['project-versions', id],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects/{id}/versions', {
        params: { path: { id } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data.items;
    },
  });
}

/** One saved version's document, to preview before restoring. */
export function useProjectVersion(id: string, version: number | null) {
  return useQuery({
    queryKey: ['project-version', id, version],
    enabled: version !== null,
    staleTime: Number.POSITIVE_INFINITY, // a saved version never changes
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects/{id}/versions/{version}', {
        params: { path: { id, version: version as number } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

/** Restores an old version as a NEW version (nothing is lost). */
export function useRestoreVersion(id: string) {
  return useMutation({
    mutationFn: async (a: { version: number; baseVersion: number }) => {
      const { data, error, response } = await api.POST('/projects/{id}/versions/{version}/restore', {
        params: { path: { id, version: a.version } },
        body: { baseVersion: a.baseVersion },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

/** Deletes a project with its versions and renders (the source videos stay in the library). */
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await api.DELETE('/projects/{id}', { params: { path: { id } } });
      if (!response.ok) throw new ApiError(response.status, error);
      return id;
    },
    onSuccess: async (id) => {
      qc.removeQueries({ queryKey: projectKey(id) });
      await qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/** Creates a project (version 1); the server validates the document and owns the id. */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['CreateProjectBody']) => {
      const { data, error, response } = await api.POST('/projects', { body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (rec) => qc.setQueryData(projectKey(rec.id), rec),
  });
}
