import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type TranscriptState = Schemas['TranscriptState'];
export type TranscriptSegment = Schemas['TranscriptSegment'];
type SegmentPage = Schemas['TranscriptSegmentPage'];

const stateKey = (sourceId: string) => ['transcript', sourceId] as const;

/** Transcript status of a source; polls while transcription runs (chunk progress). */
export function useTranscriptState(sourceId: string, enabled = true) {
  return useQuery({
    queryKey: stateKey(sourceId),
    enabled,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/sources/{id}/transcript', {
        params: { path: { id: sourceId } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 2000 : false),
  });
}

export function useStartTranscript(sourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await api.POST('/sources/{id}/transcript', {
        params: { path: { id: sourceId } },
      });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
    onSuccess: (state) => qc.setQueryData(stateKey(sourceId), state),
  });
}

/**
 * Correct (text) or revert (null) one word. The server keeps the correction as a user layer; the returned segment
 * replaces the cached one, so the list updates without refetching the transcript.
 */
export function useEditWord(sourceId: string, transcriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { seq: number; index: number; text: string | null }) => {
      const params = { path: { id: sourceId, seq: v.seq, index: v.index } };
      const res =
        v.text === null
          ? await api.DELETE('/sources/{id}/transcript/words/{seq}/{index}', { params })
          : await api.PUT('/sources/{id}/transcript/words/{seq}/{index}', { params, body: { text: v.text } });
      if (!res.data) throw new ApiError(res.response.status, res.error);
      return res.data;
    },
    onSuccess: (segment) =>
      qc.setQueryData<TranscriptSegment[]>(['transcript-segments', sourceId, transcriptId], (old) =>
        old?.map((s) => (s.seq === segment.seq ? segment : s)),
      ),
  });
}

/** Every segment of a ready transcript, fetched page by page (immutable per transcript id → cached forever). */
export function useTranscriptSegments(sourceId: string, transcriptId: string | null | undefined) {
  return useQuery({
    queryKey: ['transcript-segments', sourceId, transcriptId],
    enabled: !!transcriptId,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const all: TranscriptSegment[] = [];
      let from: number | null = 0;
      while (from !== null) {
        const cursor: number = from;
        const res = await api.GET('/sources/{id}/transcript/segments', {
          params: { path: { id: sourceId }, query: { from: cursor, limit: 1000 } },
        });
        const data: SegmentPage | undefined = res.data;
        if (!data) throw new ApiError(res.response.status, res.error);
        all.push(...data.items);
        from = data.nextFrom;
      }
      return all;
    },
  });
}
