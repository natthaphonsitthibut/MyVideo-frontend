export type RangeDraft = { start: string; end: string };
export function parseRangeTime(value: string): number | null {
  const match = /^(?:(\d+):)?(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match || (match[1] !== undefined && Number(match[2]) >= 60)) return null;
  const ms =
    (Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 +
    Number((match[4] ?? '').padEnd(3, '0'));
  return Number.isSafeInteger(ms) ? ms : null;
}
export function rangeTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${String(Math.max(0, Math.floor(ms)) % 1000).padStart(3, '0')}`;
}
export function selectedRanges(drafts: RangeDraft[], durationMs: number) {
  if (!drafts.length || drafts.length > 20) throw new Error('เลือกตั้งแต่ 1 ถึง 20 ช่วง');
  const ranges = drafts
    .map((d, i) => {
      const startMs = parseRangeTime(d.start);
      const endMs = parseRangeTime(d.end);
      if (
        startMs === null ||
        endMs === null ||
        endMs <= startMs ||
        endMs > durationMs ||
        endMs - startMs > 600000
      )
        throw new Error(`ตรวจเวลาในช่วงที่ ${i + 1}: ใช้ นาที:วินาที ภายในวิดีโอ และยาวไม่เกิน 10 นาที`);
      return { startMs, endMs };
    })
    .sort((a, b) => a.startMs - b.startMs);
  if (ranges.some((r, i) => i > 0 && r.startMs < (ranges[i - 1]?.endMs ?? 0)))
    throw new Error('ช่วงเวลาทับกัน กรุณาปรับให้แยกจากกัน');
  return ranges;
}
