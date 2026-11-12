import type { BrandTheme } from '@myvideo/stage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, ApiError, api, type Schemas } from './client';

export type BrandKit = Schemas['BrandKit'];
export type BrandKitBody = Schemas['BrandKitBody'];

const KEY = ['brand-kit'] as const;

/** The merchant's brand kit (defaults until saved). */
export function useBrandKit() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/brand-kit');
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    staleTime: 60_000,
  });
}

export function useSaveBrandKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BrandKitBody) => {
      const { data, error, response } = await api.PUT('/brand-kit', { body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (kit) => qc.setQueryData(KEY, kit),
  });
}

/** Uploads the logo as the raw request body (the server sniffs the image type). */
export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const res = await fetch(`${API_BASE_URL}/brand-kit/logo`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      const body = (await res.json().catch(() => null)) as BrandKit | null;
      if (!res.ok || !body) throw new ApiError(res.status, body as never);
      return body;
    },
    onSuccess: (kit) => qc.setQueryData(KEY, kit),
  });
}

/** The stage theme for a kit (the stage turns brand tokens into these values). */
export function brandTheme(kit: BrandKit | undefined): Partial<BrandTheme> | undefined {
  if (!kit) return undefined;
  return { primary: kit.primaryColor, accent: kit.accentColor, text: kit.textColor, font: kit.font };
}

export const brandLogoUrl = (kit?: BrandKit) =>
  `${API_BASE_URL}/brand-kit/logo?v=${encodeURIComponent(kit?.updatedAt ?? '0')}`;
