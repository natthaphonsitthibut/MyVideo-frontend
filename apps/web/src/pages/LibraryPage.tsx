import { Film, Image, RefreshCw } from 'lucide-react';
import { useLibrarySources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceCard } from '@/features/library/SourceCard';
import { UploadPanel } from '@/features/upload/UploadPanel';
import { EmptyState } from './EmptyState';

export function LibraryPage({ kind = 'video' }: { kind?: 'video' | 'photo' }) {
  const sources = useLibrarySources(kind);
  const noun = kind === 'photo' ? 'รูป' : 'วิดีโอ';
  const items = sources.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="page-layout">
      <h1 className="text-2xl font-semibold">คลัง{noun}</h1>
      <UploadPanel kind={kind} />
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
      ) : sources.isError && !sources.data ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="text-sm text-destructive">โหลดคลัง{noun}ไม่ได้</p>
          <Button variant="outline" size="sm" onClick={() => sources.refetch()}>
            <RefreshCw />
            ลองอีกครั้ง
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={kind === 'photo' ? Image : Film}
          title={`ยังไม่มี${noun}`}
          hint={
            kind === 'photo'
              ? 'อัปโหลดรูปสินค้า แล้วเพิ่มเข้าโปรเจกต์เพื่อใช้ตัดต่อได้'
              : 'อัปโหลดไลฟ์หรือคลิปรีวิวด้านบน แล้ววิดีโอจะขึ้นที่นี่พร้อมภาพตัวอย่าง'
          }
        />
      ) : (
        <ul
          className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
          aria-label={`${noun}ในคลัง`}
        >
          {items.map((s) => (
            <li key={s.id} className="[content-visibility:auto]">
              <SourceCard source={s} to={`/library/${s.id}${kind === 'photo' ? '?media=photo' : ''}`} />
            </li>
          ))}
        </ul>
      )}
      {sources.isError && sources.data ? (
        <p role="alert" className="text-sm text-destructive">
          โหลดไฟล์เพิ่มไม่สำเร็จ ลองกดโหลดเพิ่มอีกครั้ง
        </p>
      ) : null}
      {sources.hasNextPage ? (
        <Button variant="outline" disabled={sources.isFetching} onClick={() => sources.fetchNextPage()}>
          {sources.isFetchingNextPage ? 'กำลังโหลด…' : `โหลด${noun}เพิ่ม`}
        </Button>
      ) : null}
    </section>
  );
}
export function PhotoLibraryPage() {
  return <LibraryPage kind="photo" />;
}
