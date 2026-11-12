import { Download } from 'lucide-react';
import { useLiveRenders, useRenders } from '@/api/renders';
import { Skeleton } from '@/components/ui/skeleton';
import { RenderRow } from '@/features/export/RenderRow';
import { EmptyState } from './EmptyState';

export function ExportsPage() {
  const renders = useRenders();
  useLiveRenders(renders.data?.items);
  if (renders.isError) throw renders.error;
  const items = renders.data?.items ?? [];
  return (
    <section className="page-layout">
      <h1 className="text-2xl font-semibold">ไฟล์ส่งออก</h1>
      {renders.isPending ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="กำลังโหลด">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Download} title="ยังไม่มีไฟล์ส่งออก" hint="ไฟล์ MP4 ที่เรนเดอร์เสร็จจะแสดงที่นี่ให้ดาวน์โหลด" />
      ) : (
        <ul className="divide-y rounded-xl border bg-card px-4" aria-label="ไฟล์ส่งออกทั้งหมด">
          {items.map((r) => (
            <RenderRow key={r.id} render={r} showTitle />
          ))}
        </ul>
      )}
    </section>
  );
}
