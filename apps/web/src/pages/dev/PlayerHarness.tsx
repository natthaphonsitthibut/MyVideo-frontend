import {
  buildCaptions,
  canvasMeasure,
  captionFont,
  captionMaxWidth,
  loadCaptionFont,
  type Player,
  type StageProject,
} from '@myvideo/stage';
import { useQuery } from '@tanstack/react-query';
import { Profiler, useCallback } from 'react';
import { useParams } from 'react-router';
import { ApiError, api } from '@/api/client';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';

declare global {
  interface Window {
    __player?: Player | null;
    /** React commits inside the player subtree (editor-performance: none during playback). */
    __commits?: number;
  }
}

const stageLib = { buildCaptions, canvasMeasure, captionFont, captionMaxWidth, loadCaptionFont };

/** Dev-only page: the real PreviewPlayer for a saved project, instrumented for perf tests. */
export function PlayerHarness() {
  const { id = '' } = useParams();
  const project = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects/{id}', { params: { path: { id } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
  const onPlayer = useCallback((p: Player | null) => {
    window.__player = p;
    window.__stageLib = stageLib;
  }, []);
  if (project.isError) throw project.error;
  if (!project.data) return null;
  return (
    <div className="mx-auto max-w-md p-4">
      <Profiler
        id="player"
        onRender={() => {
          window.__commits = (window.__commits ?? 0) + 1;
        }}
      >
        <PreviewPlayer project={project.data.doc as unknown as StageProject} onPlayer={onPlayer} />
      </Profiler>
    </div>
  );
}
