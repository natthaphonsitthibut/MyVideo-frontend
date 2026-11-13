import { Check, Copy, Download, Timer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorText } from '@/api/client';
import { useClearTimings, useTimings } from '@/api/timings';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { jobTypeLabel, RUN_KIND_LABEL, RUN_STATUS, TONE_CLASS } from '@/features/jobs/labels';
import {
  formatBytes,
  formatMs,
  groupSteps,
  speedVsRealtime,
  type TimingRun,
  timingsCsv,
} from '@/features/timings/format';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';

/** Steps whose speed is worth comparing with the video length. */
const REALTIME_STEPS = new Set(['asr.chunk', 'media.proxy', 'media.audio', 'render.video']);

function Row({
  label,
  detail,
  ms,
  wait,
  tone,
}: {
  label: string;
  detail?: string | null;
  ms: number | null;
  wait?: number | null;
  tone?: 'running' | 'failed' | 'total';
}) {
  return (
    <tr className={cn('border-t', tone === 'total' && 'font-semibold')}>
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className={cn(tone === 'total' && 'font-semibold')}>{label}</span>
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </th>
      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums" data-testid="timing-ms">
        {formatMs(ms)}
        {tone === 'running' ? <span className="ml-1 text-xs text-primary">(กำลังทำ)</span> : null}
        {tone === 'failed' ? <span className="ml-1 text-xs text-destructive">(ล้มเหลว)</span> : null}
      </td>
      <td className="hidden py-2 text-right text-muted-foreground whitespace-nowrap tabular-nums sm:table-cell">
        {wait == null ? '' : formatMs(wait)}
      </td>
    </tr>
  );
}

function RunCard({ run }: { run: TimingRun }) {
  const status = RUN_STATUS[run.status];
  const groups = groupSteps(run.steps);
  return (
    <article className="min-w-0 rounded-xl border bg-card p-4 sm:p-5" data-testid="timing-run">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{RUN_KIND_LABEL[run.kind]}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {run.subjectTitle ?? 'ไฟล์ถูกลบแล้ว'}
            {run.mediaSeconds ? ` · ยาว ${formatMs(run.mediaSeconds * 1000)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE_CLASS[status.tone])}>
            {status.label}
          </span>
          <time className="text-xs text-muted-foreground" dateTime={run.createdAt}>
            {new Date(run.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'medium' })}
          </time>
        </div>
      </header>
      <table className="mt-3 w-full text-sm">
        <thead className="sr-only sm:not-sr-only">
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="pb-1 text-left font-normal">
              ขั้นตอน
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              ใช้เวลา
            </th>
            <th scope="col" className="hidden pb-1 text-right font-normal sm:table-cell">
              รอคิว
            </th>
          </tr>
        </thead>
        <tbody>
          {run.upload ? (
            <>
              <Row
                label="อัปโหลดไฟล์"
                detail={`${formatBytes(run.upload.bytes)}${
                  run.upload.uploadMs > 0
                    ? ` · ${((run.upload.bytes * 8) / 1e6 / (run.upload.uploadMs / 1000)).toFixed(1)} Mbps`
                    : ''
                }`}
                ms={run.upload.uploadMs}
              />
              <Row label="ย้ายไฟล์เข้าคลัง" ms={run.upload.storeMs} />
            </>
          ) : null}
          {groups.map((g) => (
            <Row
              key={g.type}
              label={jobTypeLabel(g.type)}
              detail={[
                g.count > 1 ? `${g.count} ช่วง` : null,
                REALTIME_STEPS.has(g.type) && !g.running ? speedVsRealtime(run.mediaSeconds, g.wallMs) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              ms={g.wallMs}
              wait={g.waitMs}
              tone={g.running ? 'running' : g.failed ? 'failed' : undefined}
            />
          ))}
          {run.llm ? (
            <Row
              label={`เรียก AI ${run.llm.calls} ครั้ง`}
              detail={[
                run.llm.models.join(', '),
                `${run.llm.inputTokens.toLocaleString()} → ${run.llm.outputTokens.toLocaleString()} โทเคน`,
                run.llm.costUsd != null ? `≈ $${run.llm.costUsd.toFixed(4)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              ms={run.llm.totalMs}
            />
          ) : null}
          <Row
            label="รวมทั้งงาน"
            detail={run.upload ? 'นับจากอัปโหลดเสร็จ' : null}
            ms={run.totalMs}
            tone="total"
          />
        </tbody>
      </table>
    </article>
  );
}

/** Measured times of every processing step — numbers for the presentation, copied or downloaded as a table. */
export function TimingsPage() {
  const timings = useTimings();
  const clear = useClearTimings();
  const [copied, setCopied] = useState(false);
  const items = timings.data?.items ?? [];
  const csv = () => timingsCsv(items);
  return (
    <section className="page-layout">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">บันทึกเวลา</h1>
          <p className="text-sm text-muted-foreground">
            เวลาที่ใช้จริงของแต่ละขั้น ตั้งแต่อัปโหลด ถอดเสียง ให้ AI หาช่วง ตัดต่อ จนเรนเดอร์ (วัดจากระบบ ไม่ได้ประมาณ)
          </p>
        </div>
        {items.length ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={clear.isPending} onClick={() => clear.mutate()}>
              <Trash2 aria-hidden />
              {clear.isPending ? 'กำลังล้าง…' : 'ล้างทั้งหมด'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard.writeText(csv().replaceAll(',', '\t')).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกตาราง'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([`﻿${csv()}`], { type: 'text/csv' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `myvideo-timings-${new Date().toISOString().slice(0, 19).replaceAll(':', '')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download aria-hidden />
              ดาวน์โหลด CSV
            </Button>
          </div>
        ) : null}
      </header>
      {clear.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(clear.error)}
        </p>
      ) : clear.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          ล้างประวัติทั้งหมดแล้ว {clear.data.cleared} รายการ งานเบื้องหลังยังทำต่อ
        </p>
      ) : null}
      {timings.isPending ? (
        <Skeleton className="h-40 w-full" aria-label="กำลังโหลด…" />
      ) : timings.isError ? (
        <div role="alert">
          <p>โหลดบันทึกเวลาไม่ได้</p>
          <Button variant="outline" onClick={() => timings.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="ยังไม่มีงานที่วัดเวลาได้"
          hint="อัปโหลดวิดีโอแล้วให้ AI ตัดคลิป เวลาของทุกขั้นจะขึ้นที่นี่"
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
          {items.map((run) => (
            <RunCard key={run.runId} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
