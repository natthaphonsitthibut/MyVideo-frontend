import { Film } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function LibraryPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">คลังวิดีโอ</h1>
      <EmptyState icon={Film} title="ยังไม่มีวิดีโอ" hint="วิดีโอไลฟ์หรือคลิปรีวิวที่อัปโหลดจะแสดงที่นี่" />
    </section>
  );
}
