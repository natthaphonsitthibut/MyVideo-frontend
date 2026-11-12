import { Film } from 'lucide-react';
import { useState } from 'react';
import { type RenderPreset, useLiveRenders, useProjectRenders, useRequestRender } from '@/api/renders';
import { Button } from '@/components/ui/button';
import { PRESET_LABEL, RenderRow } from './RenderRow';

/** Export the current version of a clip to MP4 and follow it to the download. */
export function ExportPanel({ projectId, version }: { projectId: string; version: number }) {
  const [preset, setPreset] = useState<RenderPreset>('standard');
  const renders = useProjectRenders(projectId);
  const request = useRequestRender(projectId);
  useLiveRenders(renders.data?.items);
  const items = renders.data?.items ?? [];
  return (
    <section className="space-y-3 rounded-xl border bg-card px-4 py-3" aria-labelledby="export-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="export-title" className="font-semibold">
          ส่งออกเป็นวิดีโอ
        </h2>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="export-preset">
            คุณภาพ
          </label>
          <select
            id="export-preset"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={preset}
            onChange={(e) => setPreset(e.target.value as RenderPreset)}
          >
            {(Object.keys(PRESET_LABEL) as RenderPreset[]).map((p) => (
              <option key={p} value={p}>
                {PRESET_LABEL[p]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            data-testid="export-button"
            disabled={request.isPending}
            onClick={() => request.mutate({ preset, version })}
          >
            <Film />
            ส่งออก MP4
          </Button>
        </div>
      </div>
      {request.isError ? (
        <p className="text-sm text-destructive" role="alert">
          ส่งออกไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง
        </p>
      ) : null}
      {items.length ? (
        <ul className="divide-y" aria-label="ไฟล์ที่ส่งออกของคลิปนี้">
          {items.map((r) => (
            <RenderRow key={r.id} render={r} />
          ))}
        </ul>
      ) : renders.isSuccess ? (
        <p className="text-sm text-muted-foreground">ยังไม่เคยส่งออก กด "ส่งออก MP4" เพื่อสร้างไฟล์</p>
      ) : null}
    </section>
  );
}
