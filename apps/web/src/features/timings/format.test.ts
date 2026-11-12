import { describe, expect, it } from 'vitest';
import { formatMs, groupSteps, speedVsRealtime, timingsCsv } from './format';

const step = (type: string, startedAt: string | null, finishedAt: string | null, runMs: number | null) => ({
  type,
  status: finishedAt ? 'succeeded' : 'running',
  attempts: 1,
  createdAt: '2026-11-13T10:00:00.000Z',
  startedAt,
  finishedAt,
  waitMs: startedAt ? 1000 : null,
  runMs,
});

describe('formatMs', () => {
  it('shows minutes and seconds the way the presentation needs', () => {
    expect(formatMs(0)).toBe('0 วิ');
    expect(formatMs(860)).toBe('0.9 วิ');
    expect(formatMs(12_400)).toBe('12 วิ');
    expect(formatMs(125_000)).toBe('2 นาที 05 วิ');
    expect(formatMs(3_725_000)).toBe('1 ชม. 02 นาที 05 วิ');
    expect(formatMs(null)).toBe('—');
  });
});

describe('groupSteps', () => {
  it('merges repeated steps (transcription chunks) into one row: wall time from first start to last end', () => {
    const rows = groupSteps([
      step('media.probe', '2026-11-13T10:00:01.000Z', '2026-11-13T10:00:02.000Z', 1000),
      step('asr.chunk', '2026-11-13T10:00:10.000Z', '2026-11-13T10:01:10.000Z', 60_000),
      step('asr.chunk', '2026-11-13T10:01:10.000Z', '2026-11-13T10:02:00.000Z', 50_000),
    ]);
    expect(rows).toEqual([
      {
        type: 'media.probe',
        count: 1,
        wallMs: 1000,
        workMs: 1000,
        waitMs: 1000,
        running: false,
        failed: false,
      },
      {
        type: 'asr.chunk',
        count: 2,
        wallMs: 110_000,
        workMs: 110_000,
        waitMs: 1000,
        running: false,
        failed: false,
      },
    ]);
  });

  it('a step that has not started has no time (never invented)', () => {
    const [row] = groupSteps([{ ...step('render.video', null, null, null), status: 'pending' }]);
    expect(row).toMatchObject({ wallMs: null, workMs: null, running: false });
  });
});

describe('speedVsRealtime', () => {
  it('compares processing time with the video length', () => {
    expect(speedVsRealtime(1800, 360_000)).toBe('เร็วกว่าเวลาจริง 5.0 เท่า');
    expect(speedVsRealtime(60, 120_000)).toBe('ช้ากว่าเวลาจริง 2.0 เท่า');
    expect(speedVsRealtime(null, 1000)).toBeNull();
    expect(speedVsRealtime(60, null)).toBeNull();
  });
});

describe('timingsCsv', () => {
  it('one row per step with seconds, quoted for spreadsheets', () => {
    const csv = timingsCsv([
      {
        runId: 'r1',
        kind: 'ingest',
        status: 'succeeded',
        subjectType: 'source',
        subjectId: null,
        subjectTitle: 'ไลฟ์ "A"',
        mediaSeconds: 1800,
        createdAt: '2026-11-13T10:00:00.000Z',
        finishedAt: '2026-11-13T10:05:00.000Z',
        totalMs: 300_000,
        upload: {
          startedAt: '2026-11-13T09:58:00.000Z',
          receivedAt: '2026-11-13T09:59:30.000Z',
          storedAt: '2026-11-13T10:00:00.000Z',
          bytes: 126_692_022,
          uploadMs: 90_000,
          storeMs: 30_000,
        },
        steps: [step('media.probe', '2026-11-13T10:00:01.000Z', '2026-11-13T10:00:02.000Z', 1000)],
        llm: null,
      },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('งาน,วิดีโอ/คลิป,ความยาววิดีโอ (วิ),ขั้นตอน,จำนวน,ใช้เวลา (วิ),รอคิว (วิ),เริ่ม');
    expect(lines[1]).toBe(
      '"นำเข้าวิดีโอ","ไลฟ์ ""A""",1800,"อัปโหลดไฟล์ (121 MB)",1,90.0,,2026-11-13T09:58:00.000Z',
    );
    expect(lines[2]).toContain('"ย้ายไฟล์เข้าคลัง",1,30.0');
    expect(lines[3]).toContain('"ตรวจไฟล์วิดีโอ",1,1.0,1.0');
    expect(lines[4]).toContain('"รวมทั้งงาน",1,300.0');
  });
});
