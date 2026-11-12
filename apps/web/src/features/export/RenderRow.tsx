import { Download, RotateCcw } from 'lucide-react';
import { type RenderSummary, renderFileUrl, useRequestRender } from '@/api/renders';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/features/jobs/labels';
import { ProgressBar, StatusPill } from '@/features/jobs/RunItem';

type Tone = 'muted' | 'active' | 'success' | 'warning' | 'danger';
export const RENDER_STATUS: Record<RenderSummary['status'], { label: string; tone: Tone }> = {
  queued: { label: 'รอคิว', tone: 'muted' },
  rendering: { label: 'กำลังเรนเดอร์', tone: 'active' },
  ready: { label: 'พร้อมดาวน์โหลด', tone: 'success' },
  failed: { label: 'ล้มเหลว', tone: 'danger' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: 'muted' },
};
export const PRESET_LABEL: Record<RenderSummary['preset'], string> = {
  standard: 'มาตรฐาน',
  high: 'คุณภาพสูง',
};

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} วิ`;

/** One export: status, live progress, download when ready, retry when failed/cancelled. */
export function RenderRow({ render, showTitle = false }: { render: RenderSummary; showTitle?: boolean }) {
  const st = RENDER_STATUS[render.status];
  const retry = useRequestRender(render.projectId);
  return (
    <li
      className="space-y-2 py-3"
      data-testid="render-row"
      data-render-id={render.id}
      data-status={render.status}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {showTitle ? <span className="font-medium break-words">{render.projectTitle}</span> : null}
        <span className="text-sm text-muted-foreground">
          เวอร์ชัน {render.projectVersion} · {PRESET_LABEL[render.preset]}
        </span>
        <StatusPill {...st} />
        <time className="text-xs text-muted-foreground" dateTime={render.createdAt}>
          {timeAgo(render.createdAt)}
        </time>
      </div>
      {render.status === 'queued' || render.status === 'rendering' ? (
        <div className="flex items-center gap-3">
          <ProgressBar value={render.progress} tone={st.tone} />
          <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {Math.round(render.progress * 100)}%
          </span>
        </div>
      ) : null}
      {render.error ? (
        <p className="text-sm text-destructive" data-testid="render-error">
          {render.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {render.status === 'ready' ? (
          <>
            <Button size="sm" asChild>
              <a href={renderFileUrl(render.id, true)} download data-testid="render-download">
                <Download />
                ดาวน์โหลด MP4
              </a>
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {render.sizeBytes ? mb(render.sizeBytes) : ''}
              {render.durationMs ? ` · ${secs(render.durationMs)}` : ''}
            </span>
          </>
        ) : null}
        {render.status === 'failed' || render.status === 'cancelled' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={retry.isPending}
            onClick={() => retry.mutate({ preset: render.preset, version: render.projectVersion })}
          >
            <RotateCcw />
            ลองใหม่
          </Button>
        ) : null}
      </div>
    </li>
  );
}
