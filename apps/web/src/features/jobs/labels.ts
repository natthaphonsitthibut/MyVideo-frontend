import type { JobSummary, RunSummary } from '@/api/runs';

export const RUN_KIND_LABEL: Record<RunSummary['kind'], string> = {
  ingest: 'นำเข้าวิดีโอ',
  transcribe: 'ถอดเสียง',
  live_to_clips: 'ตัดคลิปจากไลฟ์',
  restyle_clip: 'เปลี่ยนสไตล์คลิป',
  build_clips: 'ตัดต่อคลิปตามสไตล์ที่เลือก',
  review_to_video: 'สร้างวิดีโอรีวิว',
  render: 'เรนเดอร์ MP4',
  purge: 'ลบไฟล์ที่ลบออกแล้ว',
  system_test: 'ทดสอบระบบคิว',
};

const JOB_TYPE_LABEL: Record<string, string> = {
  'system.sleep': 'งานทดสอบ (รอเวลา)',
  'system.noop': 'งานทดสอบ',
  'media.probe': 'ตรวจไฟล์วิดีโอ',
  'media.proxy': 'ทำไฟล์พรีวิว',
  'media.audio': 'แยกเสียง',
  'media.sprites': 'ทำภาพตัวอย่าง',
  'asr.plan': 'แบ่งช่วงถอดเสียง',
  'asr.chunk': 'ถอดเสียง',
  'asr.merge': 'รวมคำถอดเสียง',
  'transcript.fix': 'AI แก้คำถอดเสียง',
  'shots.detect': 'หาช็อตในวิดีโอ',
  'review.build': 'จัดคลิปลงเทมเพลต',
  'clips.plan': 'AI หาช่วงที่น่าตัด',
  'clips.build': 'ตัดต่อคลิป',
  'clips.restyle': 'เปลี่ยนสไตล์คลิป',
  'render.video': 'เรนเดอร์ MP4',
  'storage.purge': 'ลบไฟล์',
};
export const jobTypeLabel = (type: string) => JOB_TYPE_LABEL[type] ?? type;

/** How long a step ran ("12 วิ", "3 นาที 05 วิ"); still running = up to now. */
export function stepDuration(startedAt: string, finishedAt: string | null, now: number = Date.now()): string {
  const ms = Math.max(0, (finishedAt ? Date.parse(finishedAt) : now) - Date.parse(startedAt));
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} วิ`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาที ${String(s % 60).padStart(2, '0')} วิ`;
  return `${Math.floor(m / 60)} ชม. ${String(m % 60).padStart(2, '0')} นาที`;
}

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
