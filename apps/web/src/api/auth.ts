import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type Me = Schemas['Me'];
export const ME_KEY = ['me'] as const;

/** Signed-in user, or `null` when there is no valid session (401). */
async function fetchMe(): Promise<Me | null> {
  const { data, error, response } = await api.GET('/auth/me');
  if (data) return data;
  if (response.status === 401) return null;
  throw new ApiError(response.status, error);
}

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 60_000, retry: false });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas['LoginRequest']) => {
      const { data, error, response } = await api.POST('/auth/login', { body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (me) => qc.setQueryData(ME_KEY, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { response, error } = await api.POST('/auth/logout');
      if (!response.ok && response.status !== 401) throw new ApiError(response.status, error);
    },
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}
