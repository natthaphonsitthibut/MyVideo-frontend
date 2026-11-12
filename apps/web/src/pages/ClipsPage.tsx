import { formatTimecode } from '@myvideo/timeline-core';
import { Clapperboard, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { useProjects } from '@/api/clips';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

/** All clips (projects) of the merchant, newest change first. */
export function ClipsPage() {
  const projects = useProjects();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">คลิป</h1>
      {projects.isPending ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="กำลังโหลด">
          <Skeleton className="h-14 w-full max-w-2xl" />
          <Skeleton className="h-14 w-full max-w-2xl" />
        </div>
      ) : projects.isError ? (
        <p role="alert" className="text-sm text-destructive">
          โหลดรายการคลิปไม่สำเร็จ
        </p>
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="ยังไม่มีคลิป"
          hint="เปิดวิดีโอในคลังวิดีโอ แล้วกด “สร้างคลิปอัตโนมัติ” หรือเลือกคำในคำถอดเสียงเพื่อสร้างคลิปเอง"
        />
      ) : (
        <ul className="max-w-2xl divide-y rounded-xl border bg-card" aria-label="คลิปทั้งหมด">
          {projects.data.map((p) => (
            <li key={p.id} data-testid="project-row">
              <Link
                to={`/clips/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                {p.createdBy === 'ai' ? (
                  <Sparkles className="size-4 shrink-0 text-primary" aria-label="สร้างอัตโนมัติ" />
                ) : (
                  <Clapperboard className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {formatTimecode(p.durationFrames, p.fps)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
