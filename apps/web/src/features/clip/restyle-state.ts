/** What the style picker shows (pure, unit-tested). */
export type RestyleView =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done' }
  | { kind: 'failed'; message: string };

const FALLBACK = 'เปลี่ยนสไตล์ไม่สำเร็จ ลองใหม่อีกครั้ง';
const THAI = /[฀-๿]/;
const thaiOr = (msg: string | null | undefined) => (msg && THAI.test(msg) ? msg : FALLBACK);

/** Styles can be switched for AI-made clips that record which style built them. */
export function canRestyle(meta: { createdBy?: string; styleId?: string } | undefined): boolean {
  return meta?.createdBy === 'ai' && typeof meta.styleId === 'string' && meta.styleId.length > 0;
}

export function restyleView(s: {
  requesting: boolean;
  requestError: string | null;
  run: { status: string; jobs: { error: { message: string } | null }[] } | undefined;
}): RestyleView {
  if (s.requesting) return { kind: 'working' };
  if (s.requestError !== null) return { kind: 'failed', message: thaiOr(s.requestError) };
  if (!s.run) return { kind: 'idle' };
  if (s.run.status === 'succeeded') return { kind: 'done' };
  if (s.run.status === 'failed' || s.run.status === 'cancelled') {
    const err = s.run.jobs.find((j) => j.error)?.error?.message;
    return { kind: 'failed', message: thaiOr(err) };
  }
  return { kind: 'working' };
}
