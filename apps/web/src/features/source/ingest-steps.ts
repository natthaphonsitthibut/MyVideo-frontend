import type { JobSummary } from '@/api/runs';

export const INGEST_STEPS = [
  { type: 'media.probe', label: 'ตรวจไฟล์' },
  { type: 'media.proxy', label: 'ทำไฟล์พรีวิว' },
  { type: 'media.audio', label: 'แยกเสียงและคลื่นเสียง' },
  { type: 'media.sprites', label: 'ทำภาพตัวอย่าง' },
] as const;

/** One line for a card: which step runs and how far ingest is overall (0..1). */
export function ingestProgress(jobs: JobSummary[]): { label: string; overall: number } {
  const byType = new Map(jobs.map((j) => [j.type, j]));
  let done = 0;
  for (const s of INGEST_STEPS) if (byType.get(s.type)?.status === 'succeeded') done++;
  const current = INGEST_STEPS.find((s) => {
    const j = byType.get(s.type);
    return j && j.status !== 'succeeded';
  });
  const cur = current ? byType.get(current.type) : undefined;
  const overall = Math.min(1, (done + (cur?.progress ?? 0)) / INGEST_STEPS.length);
  return { label: current ? current.label : done === INGEST_STEPS.length ? 'เสร็จแล้ว' : 'รอคิว', overall };
}
