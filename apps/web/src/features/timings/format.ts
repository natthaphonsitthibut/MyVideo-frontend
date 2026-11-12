import type { Schemas } from '@/api/client';
import { jobTypeLabel, RUN_KIND_LABEL } from '@/features/jobs/labels';

export type TimingRun = Schemas['TimingRun'];
export type TimingStep = Schemas['TimingStep'];

/** "2 นาที 05 วิ" — the numbers read out in a presentation. Sub-second values keep one decimal. */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return ms === 0 ? '0 วิ' : `${(ms / 1000).toFixed(1)} วิ`;
  const total = Math.round(ms / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h} ชม. ${pad(m)} นาที ${pad(s)} วิ`;
  if (m > 0) return `${m} นาที ${pad(s)} วิ`;
  return `${s} วิ`;
}

export type StepGroup = {
  type: string;
  count: number;
  /** First start → last end (or null while nothing has started). */
  wallMs: number | null;
  /** Sum of each step's own running time. */
  workMs: number | null;
  /** Queue wait of the first step. */
  waitMs: number | null;
  running: boolean;
  failed: boolean;
};

/** Repeated steps of one type (e.g. transcription chunks) become one row, in first-seen order. */
export function groupSteps(steps: readonly TimingStep[]): StepGroup[] {
  const order: string[] = [];
  const by = new Map<string, TimingStep[]>();
  for (const s of steps) {
    if (!by.has(s.type)) {
      by.set(s.type, []);
      order.push(s.type);
    }
    by.get(s.type)?.push(s);
  }
  return order.map((type) => {
    const xs = by.get(type) ?? [];
    const started = xs.flatMap((s) => (s.startedAt ? [Date.parse(s.startedAt)] : []));
    const finished = xs.flatMap((s) => (s.finishedAt ? [Date.parse(s.finishedAt)] : []));
    const running = xs.some((s) => s.status === 'running');
    const ran = xs.filter((s) => s.runMs != null);
    let wallMs: number | null = null;
    if (started.length) {
      const end = running || finished.length < started.length ? Date.now() : Math.max(...finished);
      wallMs = Math.max(0, end - Math.min(...started));
    }
    return {
      type,
      count: xs.length,
      wallMs,
      workMs: ran.length ? ran.reduce((a, s) => a + (s.runMs ?? 0), 0) : null,
      waitMs: xs[0]?.waitMs ?? null,
      running,
      failed: xs.some((s) => s.status === 'dead' || s.status === 'failed'),
    };
  });
}

/** Processing time vs. the video's own length ("เร็วกว่าเวลาจริง 5.0 เท่า"). */
export function speedVsRealtime(mediaSeconds: number | null, ms: number | null): string | null {
  if (!mediaSeconds || !ms) return null;
  const ratio = (mediaSeconds * 1000) / ms;
  return ratio >= 1 ? `เร็วกว่าเวลาจริง ${ratio.toFixed(1)} เท่า` : `ช้ากว่าเวลาจริง ${(1 / ratio).toFixed(1)} เท่า`;
}

export const formatBytes = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;

const q = (s: string) => `"${s.replaceAll('"', '""')}"`;
const sec = (ms: number | null | undefined) => (ms == null ? '' : (ms / 1000).toFixed(1));

/** CSV (one row per step) to paste into slides or a spreadsheet. */
export function timingsCsv(runs: readonly TimingRun[]): string {
  const head = 'งาน,วิดีโอ/คลิป,ความยาววิดีโอ (วิ),ขั้นตอน,จำนวน,ใช้เวลา (วิ),รอคิว (วิ),เริ่ม';
  const lines = [head];
  for (const r of runs) {
    const base = [q(RUN_KIND_LABEL[r.kind]), q(r.subjectTitle ?? ''), r.mediaSeconds ?? ''].join(',');
    const row = (
      label: string,
      count: number,
      ms: number | null,
      wait: number | null,
      start: string | null,
    ) => lines.push(`${base},${q(label)},${count},${sec(ms)},${sec(wait)},${start ?? ''}`);
    if (r.upload) {
      row(`อัปโหลดไฟล์ (${formatBytes(r.upload.bytes)})`, 1, r.upload.uploadMs, null, r.upload.startedAt);
      row('ย้ายไฟล์เข้าคลัง', 1, r.upload.storeMs, null, r.upload.receivedAt);
    }
    for (const g of groupSteps(r.steps)) {
      const first = r.steps.find((s) => s.type === g.type);
      row(jobTypeLabel(g.type), g.count, g.wallMs, g.waitMs, first?.startedAt ?? null);
    }
    if (r.llm) row(`เรียก AI (${r.llm.models.join(' ')})`, r.llm.calls, r.llm.totalMs, null, null);
    row('รวมทั้งงาน', 1, r.totalMs, null, r.createdAt);
  }
  return `${lines.join('\n')}\n`;
}
