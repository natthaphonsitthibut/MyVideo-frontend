import type { JobSummary, RunSummary } from '@/api/runs';

export const RUN_KIND_LABEL: Record<RunSummary['kind'], string> = {
  ingest: 'นำเข้าวิดีโอ',
  transcribe: 'ถอดเสียง',
  live_to_clips: 'ตัดคลิปจากไลฟ์',
  review_to_video: 'สร้างวิดีโอรีวิว',
  render: 'เรนเดอร์ MP4',
  system_test: 'ทดสอบระบบคิว',
};

const JOB_TYPE_LABEL: Record<string, string> = {
  'system.sleep': 'งานทดสอบ (รอเวลา)',
  'system.noop': 'งานทดสอบ',
};
export const jobTypeLabel = (type: string) => JOB_TYPE_LABEL[type] ?? type;

type Tone = 'muted' | 'active' | 'success' | 'warning' | 'danger';
export const JOB_STATUS: Record<JobSummary['status'], { label: string; tone: Tone }> = {
  pending: { label: 'รอคิว', tone: 'muted' },
  queued: { label: 'อยู่ในคิว', tone: 'muted' },
  running: { label: 'กำลังทำงาน', tone: 'active' },
  succeeded: { label: 'เสร็จแล้ว', tone: 'success' },
  failed: { label: 'จะลองใหม่', tone: 'warning' },
  dead: { label: 'ล้มเหลว', tone: 'danger' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: 'muted' },
};
export const RUN_STATUS: Record<RunSummary['status'], { label: string; tone: Tone }> = {
  pending: { label: 'รอเริ่ม', tone: 'muted' },
  running: { label: 'กำลังทำงาน', tone: 'active' },
  succeeded: { label: 'เสร็จแล้ว', tone: 'success' },
  failed: { label: 'ล้มเหลว', tone: 'danger' },
  cancelled: { label: 'ยกเลิกแล้ว', tone: 'muted' },
};

export const TONE_CLASS: Record<Tone, string> = {
  muted: 'bg-muted text-muted-foreground',
  active: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
/** "2 นาทีที่แล้ว" style; absolute date for anything older than a day. */
export function timeAgo(iso: string, now = Date.now()): string {
  const sec = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), 'hour');
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
