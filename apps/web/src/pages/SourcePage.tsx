import { ArrowLeft, CircleAlert, RotateCcw } from 'lucide-react';
import { useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useJobAction } from '@/api/runs';
import { formatDuration, useLiveRun, useSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { JOB_STATUS, TONE_CLASS } from '@/features/jobs/labels';
import { INGEST_STEPS } from '@/features/source/ingest-steps';
import { ProxyPlayer } from '@/features/source/ProxyPlayer';
import { TranscriptPanel } from '@/features/transcript/TranscriptPanel';
import { formatBytes } from '@/features/upload/upload-manager';
import { cn } from '@/lib/utils';

function IngestSteps({ runId }: { runId: string | null }) {
  const run = useLiveRun(runId);
  const retry = useJobAction('retry');
  const jobs = run.data?.jobs ?? [];
  const dead = jobs.find((j) => j.status === 'dead');
  return (
    <ol className="space-y-2" aria-label="ขั้นตอนการประมวลผล">
      {INGEST_STEPS.map((step) => {
        const j = jobs.find((x) => x.type === step.type);
        const st = j ? JOB_STATUS[j.status] : { label: 'รอ', tone: 'muted' as const };
        return (
          <li
            key={step.type}
            className="flex items-center gap-3"
            data-testid="ingest-step"
            data-step={step.type}
            data-status={j?.status ?? 'waiting'}
          >
            <span className="w-44 shrink-0 text-sm">{step.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full origin-left rounded-full transition-transform duration-200',
                  j?.status === 'dead'
                    ? 'bg-destructive'
                    : j?.status === 'succeeded'
                      ? 'bg-success'
                      : 'bg-primary',
                )}
                style={{ transform: `scaleX(${j ? j.progress : 0})` }}
              />
            </div>
            <span
              className={cn(
                'w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs',
                TONE_CLASS[st.tone],
              )}
            >
              {st.label}
            </span>
          </li>
        );
      })}
      {dead ? (
        <li className="pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={retry.isPending}
            onClick={() => retry.mutate(dead.id)}
          >
            <RotateCcw />
            ลองขั้นตอนนี้ใหม่
          </Button>
        </li>
      ) : null}
    </ol>
  );
}

export function SourcePage() {
  const { id = '' } = useParams();
  const source = useSource(id);
  const videoRef = useRef<HTMLVideoElement>(null);
  if (source.isPending) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลด">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-video w-full max-w-3xl rounded-xl" />
      </div>
    );
  }
  if (source.isError) throw source.error;
  const s = source.data;
  return (
    <section className="w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/library">
            <ArrowLeft />
            คลังวิดีโอ
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold break-words">{s.title}</h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDuration(s.durationMs)}
          {s.width && s.height ? ` · ${s.width}×${s.height}` : ''} · {formatBytes(s.sizeBytes)} ·{' '}
          {s.originalFilename}
        </p>
      </div>
      {s.status === 'failed' ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{s.failureReason ?? 'ประมวลผลไม่สำเร็จ'}</span>
        </div>
      ) : null}
      {s.status !== 'ready' ? (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">{s.status === 'failed' ? 'ขั้นตอนที่ทำแล้ว' : 'กำลังเตรียมวิดีโอ'}</h2>
          <IngestSteps runId={s.ingestRunId} />
        </div>
      ) : null}
      {s.hasProxy ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <ProxyPlayer source={s} videoRef={videoRef} />
          {s.status === 'ready' ? (
            <TranscriptPanel
              sourceId={s.id}
              hasAudio={s.hasAudio}
              videoRef={videoRef}
              clipSource={
                s.fps && s.durationFrames
                  ? { id: s.id, fps: s.fps, durationFrames: s.durationFrames, hasAudio: !!s.hasAudio }
                  : null
              }
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
