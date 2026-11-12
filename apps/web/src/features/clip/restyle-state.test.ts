import { describe, expect, it } from 'vitest';
import { canRestyle, restyleView } from './restyle-state';

const run = (status: string, error: string | null = null) => ({
  status,
  jobs: [{ error: error ? { message: error } : null }],
});

describe('restyle state', () => {
  it('offers styles only for AI clips that know their style', () => {
    expect(canRestyle({ createdBy: 'ai', styleId: 'sale-fast' })).toBe(true);
    expect(canRestyle({ createdBy: 'ai' })).toBe(false);
    expect(canRestyle({ createdBy: 'user', styleId: 'sale-fast' })).toBe(false);
    expect(canRestyle(undefined)).toBe(false);
  });

  it('idle without a run; working from the request until the run ends', () => {
    expect(restyleView({ requesting: false, requestError: null, run: undefined })).toEqual({ kind: 'idle' });
    expect(restyleView({ requesting: true, requestError: null, run: undefined })).toEqual({
      kind: 'working',
    });
    expect(restyleView({ requesting: false, requestError: null, run: run('pending') })).toEqual({
      kind: 'working',
    });
    expect(restyleView({ requesting: false, requestError: null, run: run('running') })).toEqual({
      kind: 'working',
    });
    expect(restyleView({ requesting: false, requestError: null, run: run('succeeded') })).toEqual({
      kind: 'done',
    });
  });

  it('a failed run shows the job error (already Thai) or a plain Thai fallback', () => {
    expect(
      restyleView({
        requesting: false,
        requestError: null,
        run: run('failed', 'คลิปนี้สร้างก่อนรองรับการเปลี่ยนสไตล์ — สร้างคลิปใหม่อีกครั้ง'),
      }),
    ).toEqual({ kind: 'failed', message: 'คลิปนี้สร้างก่อนรองรับการเปลี่ยนสไตล์ — สร้างคลิปใหม่อีกครั้ง' });
    expect(
      restyleView({ requesting: false, requestError: null, run: run('failed', 'TimeoutError: x') }),
    ).toEqual({
      kind: 'failed',
      message: 'เปลี่ยนสไตล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
    });
    expect(restyleView({ requesting: false, requestError: null, run: run('cancelled') }).kind).toBe('failed');
  });

  it('a refused request shows the server message when it is Thai', () => {
    expect(
      restyleView({ requesting: false, requestError: 'คลิปนี้สร้างก่อนรองรับการเปลี่ยนสไตล์', run: undefined }),
    ).toEqual({ kind: 'failed', message: 'คลิปนี้สร้างก่อนรองรับการเปลี่ยนสไตล์' });
    expect(restyleView({ requesting: false, requestError: 'Bad Request', run: undefined })).toEqual({
      kind: 'failed',
      message: 'เปลี่ยนสไตล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
    });
  });
});
