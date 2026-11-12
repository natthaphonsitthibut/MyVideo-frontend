import { RotateCcw, Square } from 'lucide-react';
import { type JobSummary, type RunSummary, useJobAction } from '@/api/runs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JOB_STATUS, jobTypeLabel, RUN_KIND_LABEL, RUN_STATUS, TONE_CLASS, timeAgo } from './labels';

export function StatusPill({ label, tone }: { label: string; tone: keyof typeof TONE_CLASS }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
      )}
    >
      {tone === 'active' ? (
        <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone: keyof typeof TONE_CLASS }) {
  const pct = Math.round(value * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label="ความคืบหน้า"
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          'h-full origin-left rounded-full transition-transform duration-200 ease-out',
          tone === 'danger'
            ? 'bg-destructive'
            : tone === 'success'
              ? 'bg-success'
              : tone === 'muted'
                ? 'bg-muted-foreground/40'
                : 'bg-primary',
        )}
        style={{ transform: `scaleX(${value})` }}
      />
    </div>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  const st = JOB_STATUS[job.status];
  const cancel = useJobAction('cancel');
  const retry = useJobAction('retry');
  const canCancel = ['pending', 'queued', 'running', 'failed'].includes(job.status) && !job.cancelRequested;
  const canRetry = job.status === 'dead' || job.status === 'cancelled';
  return (
    <li
      className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center sm:gap-6"
      data-testid="job-row"
      data-status={job.status}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{jobTypeLabel(job.type)}</span>
          <StatusPill {...st} />
          <span className="text-xs text-muted-foreground tabular-nums">
            ครั้งที่ {Math.max(job.attempts, 1)}/{job.maxAttempts}
          </span>
          {job.cancelRequested && job.status === 'running' ? (
            <span className="text-xs text-muted-foreground">กำลังหยุด…</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={job.progress} tone={st.tone} />
          <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {Math.round(job.progress * 100)}%
          </span>
        </div>
        {job.error && (job.status === 'dead' || job.status === 'failed') ? (
          <p className="text-sm break-words text-destructive" data-testid="job-error">
            {job.error.message}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 sm:justify-end">
        {canCancel ? (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(job.id)}
          >
            <Square />
            ยกเลิก
          </Button>
        ) : null}
        {canRetry ? (
          <Button variant="outline" size="sm" disabled={retry.isPending} onClick={() => retry.mutate(job.id)}>
            <RotateCcw />
            ลองใหม่
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function RunItem({ run }: { run: RunSummary }) {
  const st = RUN_STATUS[run.status];
  return (
    <article
      className="rounded-xl border bg-card px-4 py-3 sm:px-5"
      data-testid="run-item"
      data-kind={run.kind}
      data-run-id={run.id}
      data-status={run.status}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{RUN_KIND_LABEL[run.kind]}</h2>
          <StatusPill {...st} />
        </div>
        <time
          className="text-xs text-muted-foreground"
          dateTime={run.createdAt}
          title={new Date(run.createdAt).toLocaleString('th-TH')}
        >
          {timeAgo(run.createdAt)}
        </time>
      </header>
      <ul className="divide-y">
        {run.jobs.map((j) => (
          <JobRow key={j.id} job={j} />
        ))}
      </ul>
    </article>
  );
}
