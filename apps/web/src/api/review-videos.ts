import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type TemplateVersion = Schemas['TemplateVersion'];
export type ReviewVideoState = Schemas['ReviewVideoState'];
export type ReviewShot = Schemas['ReviewShot'];
export type CreateReviewVideoBody = Schemas['CreateReviewVideoBody'];
export type ShotRole = ReviewShot['role'];

export const SHOT_ROLE_NAMES: Record<ShotRole, string> = {
  talking_head: 'พูดหน้ากล้อง',
  product_closeup: 'ภาพสินค้าใกล้ ๆ',
  demo: 'สาธิตการใช้งาน',
  unboxing: 'แกะกล่อง',
  broll: 'ภาพประกอบ',
};

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/templates');
      if (!data) throw new ApiError(response.status, error);
      return data.items;
    },
    staleTime: 5 * 60_000,
  });
}

const running = (s: ReviewVideoState | undefined) => s?.status === 'pending' || s?.status === 'running';

/** A review video run; polls every 2 s until it finishes. */
export function useReviewVideo(runId: string | null) {
  return useQuery({
    queryKey: ['review-video', runId],
    enabled: Boolean(runId),
    queryFn: async () => {
      const { data, error, response } = await api.GET('/review-videos/{id}', {
        params: { path: { id: runId as string } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q) => (running(q.state.data) || !q.state.data ? 2000 : false),
  });
}

export function useCreateReviewVideo() {
  return useMutation({
    mutationFn: async (body: CreateReviewVideoBody) => {
      const { data, error, response } = await api.POST('/review-videos', { body });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

export function useSwapTemplate(projectId: string) {
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error, response } = await api.POST('/projects/{id}/template', {
        params: { path: { id: projectId } },
        body: { templateId },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

export { errorText } from './client';
