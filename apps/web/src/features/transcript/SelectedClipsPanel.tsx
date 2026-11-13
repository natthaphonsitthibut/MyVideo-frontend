import { LoaderCircle, Plus, Scissors, X } from 'lucide-react';
import { type RefObject, useState } from 'react';
import { Link } from 'react-router';
import { errorText } from '@/api/client';
import { useJobAction } from '@/api/runs';
import { useSelectedClips, useStartSelectedClips } from '@/api/selected-clips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type RangeDraft, rangeTime, selectedRanges } from './selected-ranges';

export function SelectedClipsPanel({
  sourceId,
  durationMs,
  videoRef,
  clipSearch,
}: {
  sourceId: string;
  durationMs: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  clipSearch: string;
}) {
  const [drafts, setDrafts] = useState<(RangeDraft & { id: string })[]>(() => [
    { id: crypto.randomUUID(), start: '0:00', end: rangeTime(Math.min(60000, durationMs)) },
  ]);
  const [error, setError] = useState('');
  const state = useSelectedClips(sourceId);
  const start = useStartSelectedClips(sourceId);
  const retry = useJobAction('retry');
  const cancel = useJobAction('cancel');
  const clips = state.data?.clips ?? [];
  const busy = clips.some((c) => c.status === 'pending' || c.status === 'running');
  const patch = (id: string, field: 'start' | 'end', value: string) => {
    setDrafts((old) => old.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setError('');
  };
  const submit = () => {
    try {
      const ranges = selectedRanges(drafts, durationMs);
      setError('');
      start.mutate({ requestId: crypto.randomUUID(), ranges });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตรวจช่วงเวลาอีกครั้ง');
    }
  };
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby="selected-clips-heading">
      <div className="space-y-1">
        <h2 id="selected-clips-heading" className="font-medium">
          เลือกช่วงถอดเสียงและสร้างคลิปเอง
        </h2>
        <p className="text-sm text-muted-foreground">
          ถอดเสียงเฉพาะช่วงที่เลือก แล้วบันทึกเป็นคลิปแยกพร้อมซับ ไม่ต้องให้ AI หาช่วงให้ ต้นฉบับยังอยู่เหมือนเดิม
        </p>
      </div>
      <fieldset className="space-y-3" disabled={start.isPending || busy}>
        <legend className="sr-only">ช่วงเวลาที่ต้องการ</legend>
        {drafts.map((d, i) => (
          <div key={d.id} className="flex flex-wrap items-end gap-2 border-b pb-3 last:border-0">
            <span className="w-full text-sm font-medium">ช่วงที่ {i + 1}</span>
            {(['start', 'end'] as const).map((field) => (
              <div key={field} className="min-w-0 flex-1 basis-40 space-y-1">
                <label htmlFor={`${d.id}-${field}`} className="text-xs">
                  {field === 'start' ? 'เริ่ม' : 'สิ้นสุด'} (นาที:วินาที)
                </label>
                <div className="flex gap-1">
                  <Input
                    id={`${d.id}-${field}`}
                    value={d[field]}
                    onChange={(e) => patch(d.id, field, e.target.value)}
                    placeholder="0:00"
                    className="min-w-0 tabular-nums"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="h-9 shrink-0"
                    aria-label={`ใช้เวลาที่เล่นเป็น${field === 'start' ? 'จุดเริ่ม' : 'จุดสิ้นสุด'}ช่วงที่ ${i + 1}`}
                    onClick={() => {
                      const v = videoRef.current;
                      if (v)
                        patch(d.id, field, rangeTime(Math.min(durationMs, Math.round(v.currentTime * 1000))));
                    }}
                  >
                    ใช้เวลาที่เล่น
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="icon"
              type="button"
              disabled={drafts.length === 1}
              aria-label={`ลบช่วงที่ ${i + 1}`}
              onClick={() => setDrafts((old) => old.filter((r) => r.id !== d.id))}
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          type="button"
          disabled={drafts.length >= 20}
          onClick={() => setDrafts((old) => [...old, { id: crypto.randomUUID(), start: '', end: '' }])}
        >
          <Plus />
          เพิ่มช่วง
        </Button>
        <p className="text-xs text-muted-foreground">เลือกได้ 20 ช่วง ช่วงละไม่เกิน 10 นาที ช่วงเวลาต้องไม่ทับกัน</p>
      </fieldset>
      {error || start.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {error || errorText(start.error)}
        </p>
      ) : null}
      <Button disabled={start.isPending || busy || state.isPending || state.isError} onClick={submit}>
        <Scissors />
        {start.isPending ? 'กำลังส่งงาน…' : `ถอดเสียงและสร้าง ${drafts.length} คลิป`}
      </Button>
      {state.isError ? (
        <p role="alert" className="text-sm text-destructive">
          โหลดสถานะไม่ได้{' '}
          <Button variant="ghost" onClick={() => state.refetch()}>
            ลองอีกครั้ง
          </Button>
        </p>
      ) : null}
      {clips.length ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm">
            เสร็จ {clips.filter((c) => c.status === 'ready').length}/{clips.length} คลิป · เปลี่ยนหน้าได้
            ระบบทำต่อเบื้องหลัง
          </p>
          <ul className="divide-y">
            {clips.map((c, i) => (
              <li key={c.projectId} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1 tabular-nums">
                  ช่วง {i + 1}: {rangeTime(c.startMs)}–{rangeTime(c.endMs)}
                </span>
                {c.status === 'ready' ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/clips/${c.projectId}${clipSearch}`}>เปิดคลิป</Link>
                  </Button>
                ) : c.status === 'failed' || c.status === 'cancelled' ? (
                  <>
                    <span className="text-destructive">
                      {c.status === 'failed' ? 'ถอดเสียงไม่สำเร็จ' : 'ยกเลิกแล้ว'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retry.isPending || !c.jobId}
                      onClick={() =>
                        c.jobId &&
                        retry.mutate(c.jobId, {
                          onSuccess: () => {
                            void state.refetch();
                          },
                        })
                      }
                    >
                      ลองใหม่
                    </Button>
                  </>
                ) : (
                  <>
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                    <span>{c.status === 'pending' ? 'รอคิว' : 'กำลังถอดเสียง'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cancel.isPending || !c.jobId}
                      onClick={() =>
                        c.jobId &&
                        cancel.mutate(c.jobId, {
                          onSuccess: () => {
                            void state.refetch();
                          },
                        })
                      }
                    >
                      ยกเลิก
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {retry.isError || cancel.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(retry.error ?? cancel.error)}
        </p>
      ) : null}
    </section>
  );
}
