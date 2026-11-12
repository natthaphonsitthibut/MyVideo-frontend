import { FlaskConical, ListChecks, RefreshCw } from 'lucide-react';
import { useCreateTestRun, useLiveRuns, useRuns } from '@/api/runs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RunItem } from '@/features/jobs/RunItem';
import { EmptyState } from './EmptyState';

export function JobsPage() {
  const runs = useRuns();
  useLiveRuns(runs.data);
  const test = useCreateTestRun();
  const startTest = (failFirstAttempt: boolean) => test.mutate({ ms: 6000, steps: 12, failFirstAttempt });
  return (
    <section className="page-layout">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">งานประมวลผล</h1>
          <p className="text-sm text-muted-foreground">
            งานเบื้องหลัง เช่น นำเข้าวิดีโอ ถอดเสียง และเรนเดอร์ อัปเดตสดอัตโนมัติ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={test.isPending} onClick={() => startTest(false)}>
            <FlaskConical />
            ทดสอบระบบคิว
          </Button>
          <Button variant="ghost" size="sm" disabled={test.isPending} onClick={() => startTest(true)}>
            ทดสอบกรณีล้มเหลว
          </Button>
        </div>
      </div>
      {test.isError ? (
        <p role="alert" className="text-sm text-destructive">
          เริ่มงานทดสอบไม่ได้ — มีงานค้างมากเกินไปหรือเซิร์ฟเวอร์ไม่ตอบ
        </p>
      ) : null}
      {runs.isPending ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="กำลังโหลด">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : runs.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="text-sm text-destructive">โหลดรายการงานไม่ได้</p>
          <Button variant="outline" size="sm" onClick={() => runs.refetch()}>
            <RefreshCw />
            ลองอีกครั้ง
          </Button>
        </div>
      ) : runs.data.items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="ยังไม่มีงานประมวลผล"
          hint="เมื่ออัปโหลดวิดีโอ งานนำเข้า ถอดเสียง และตัดคลิปจะแสดงที่นี่พร้อมความคืบหน้า กด “ทดสอบระบบคิว” เพื่อลองดูได้"
        />
      ) : (
        <div className="space-y-3">
          {runs.data.items.map((run) => (
            <RunItem key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
