import { mountStage, type Stage, type StageProject } from '@myvideo/stage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { API_BASE_URL, ApiError, api } from '@/api/client';

declare global {
  interface Window {
    __stage?: Stage & { durationFrames: number };
  }
}

/**
 * Dev-only page: mounts the stage for a saved project at full resolution and exposes it as `window.__stage`, so
 * Playwright can seek frames and capture them (visual regression). Preview media = the source proxies.
 */
export function StageHarness() {
  const { id = '' } = useParams();
  const host = useRef<HTMLDivElement>(null);
  const project = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/projects/{id}', { params: { path: { id } } });
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });

  useEffect(() => {
    const el = host.current;
    const doc = project.data?.doc;
    if (!el || !doc) return;
    const stage = mountStage(
      el,
      doc as unknown as StageProject,
      (_assetId, asset) => `${API_BASE_URL}/sources/${asset.sourceId}/assets/proxy`,
    );
    window.__stage = Object.assign(stage, { durationFrames: doc.durationFrames });
    return () => {
      delete window.__stage;
      stage.destroy();
    };
  }, [project.data]);

  if (project.isError) throw project.error;
  return <div ref={host} data-testid="stage-host" style={{ width: 'fit-content' }} />;
}
