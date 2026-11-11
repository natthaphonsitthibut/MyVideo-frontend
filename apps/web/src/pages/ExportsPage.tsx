import { Download } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function ExportsPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">ไฟล์ส่งออก</h1>
      <EmptyState icon={Download} title="ยังไม่มีไฟล์ส่งออก" hint="ไฟล์ MP4 ที่เรนเดอร์เสร็จจะแสดงที่นี่ให้ดาวน์โหลด" />
    </section>
  );
}
