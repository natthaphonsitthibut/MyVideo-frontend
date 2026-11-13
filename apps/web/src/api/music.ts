import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, ApiError, api, type Schemas } from './client';
export type Music = Schemas['MusicRecord'];
export function useMusic() {
  return useQuery({
    queryKey: ['music'],
    queryFn: async () => {
      const r = await api.GET('/music');
      if (!r.data) throw new ApiError(r.response.status, r.error);
      return r.data.items;
    },
    refetchInterval: (q) => (q.state.data?.some((m) => m.status === 'processing') ? 2000 : false),
  });
}
export function useUploadMusic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { file: File; license: string }) => {
      const query = new URLSearchParams({ title: a.file.name.slice(0, 200), license: a.license });
      const res = await fetch(`${API_BASE_URL}/music?${query}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': a.file.type || 'application/octet-stream' },
        body: a.file,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as Music;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music'] }),
  });
}
