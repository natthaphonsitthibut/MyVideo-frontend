import { Film } from 'lucide-react';
import { UploadPanel } from '@/features/upload/UploadPanel';
import { EmptyState } from './EmptyState';

export function LibraryPage() {
  return (
    <section className="w-full max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">คลังวิดีโอ</h1>
      <UploadPanel />
      <EmptyState icon={Film} title="ยังไม่มีวิดีโอ" hint="วิดีโอไลฟ์หรือคลิปรีวิวที่อัปโหลดจะแสดงที่นี่" />
    </section>
  );
}
