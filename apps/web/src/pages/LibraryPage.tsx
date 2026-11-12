import { Film, RefreshCw } from 'lucide-react';
import { useSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceCard } from '@/features/library/SourceCard';
import { UploadPanel } from '@/features/upload/UploadPanel';
import { EmptyState } from './EmptyState';

export function LibraryPage() {
  const sources = useSources();
  return (
    <section className="w-full max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">คลังวิดีโอ</h1>
      <UploadPanel />
      {sources.isPending ? (
        <div
          className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
          role="status"
          aria-busy="true"
          aria-label="กำลังโหลด"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      ) : sources.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="text-sm text-destructive">โหลดคลังวิดีโอไม่ได้</p>
          <Button variant="outline" size="sm" onClick={() => sources.refetch()}>
            <RefreshCw />
            ลองอีกครั้ง
          </Button>
        </div>
      ) : sources.data.items.length === 0 ? (
        <EmptyState icon={Film} title="ยังไม่มีวิดีโอ" hint="อัปโหลดไลฟ์หรือคลิปรีวิวด้านบน แล้ววิดีโอจะขึ้นที่นี่พร้อมภาพตัวอย่าง" />
      ) : (
        <ul
          className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
          aria-label="วิดีโอในคลัง"
        >
          {sources.data.items.map((s) => (
            <li key={s.id}>
              <SourceCard source={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
