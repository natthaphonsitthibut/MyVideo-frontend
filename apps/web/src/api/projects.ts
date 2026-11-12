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
