import { CircleAlert, Film } from 'lucide-react';
import { Link } from 'react-router';
import { formatDuration, type SourceSummary, spriteSheetUrl, useLiveRun } from '@/api/sources';
import { cn } from '@/lib/utils';
import { ingestProgress } from '../source/ingest-steps';
import { spriteStyle } from './sprite';

const CARD_W = 280;

function Thumb({ source }: { source: SourceSummary }) {
  const idx = source.sprites;
  if (!idx) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <Film className="size-8" aria-hidden />
      </div>
    );
  }
  // a frame from ~10 % in reads better than the very first frame (often black)
  const t = Math.min((idx.durationMs / 1000) * 0.1, 30);
  const tileH = (CARD_W * idx.tileHeight) / idx.tileWidth;
  const portrait = idx.tileHeight > idx.tileWidth;
  const w = portrait ? (CARD_W * 9) / 16 / (idx.tileHeight / idx.tileWidth) : CARD_W;
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div
        role="img"
        aria-label={`ภาพตัวอย่าง ${source.title}`}
        style={{
          width: w,
          height: portrait ? (CARD_W * 9) / 16 : tileH,
          ...spriteStyle((n) => spriteSheetUrl(source.id, n), idx, t, w),
        }}
      />
    </div>
  );
}

function Processing({ runId }: { runId: string | null }) {
  const run = useLiveRun(runId);
  const p = ingestProgress(run.data?.jobs ?? []);
  return (
    <div className="space-y-1.5" data-testid="card-progress">
      <p className="text-xs text-primary">
        {p.label} · {Math.round(p.overall * 100)}%
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-200"
          style={{ transform: `scaleX(${p.overall})` }}
        />
      </div>
    </div>
  );
}

export function SourceCard({ source }: { source: SourceSummary }) {
  return (
    <Link
      to={`/library/${source.id}`}
      className="group block overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      data-testid="source-card"
      data-status={source.status}
    >
      <div className="relative aspect-video overflow-hidden">
        <Thumb source={source} />
        {source.durationMs ? (
          <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white tabular-nums">
            {formatDuration(source.durationMs)}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate font-medium" title={source.title}>
          {source.title}
        </p>
        {source.status === 'processing' ? <Processing runId={source.ingestRunId} /> : null}
        {source.status === 'failed' ? (
          <p className={cn('flex items-start gap-1.5 text-xs text-destructive')}>
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{source.failureReason ?? 'ประมวลผลไม่สำเร็จ'}</span>
          </p>
        ) : null}
        {source.status === 'ready' ? (
          <p className="text-xs text-muted-foreground">
            {source.width && source.height ? `${source.width}×${source.height}` : ''}
            {source.hasAudio === false ? ' · ไม่มีเสียง' : ''}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
