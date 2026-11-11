import { Clapperboard } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function ClipsPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">คลิป</h1>
      <EmptyState
        icon={Clapperboard}
        title="ยังไม่มีคลิป"
        hint="คลิปสั้นที่สร้างจากวิดีโอของคุณจะแสดงที่นี่ และแก้ไขต่อได้ทุกคลิป"
      />
    </section>
  );
}
