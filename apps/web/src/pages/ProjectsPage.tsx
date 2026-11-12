import { formatTimecode } from '@myvideo/timeline-core';
import { Clapperboard, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useProjects } from '@/api/clips';
import { useDeleteProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

type Row = { id: string; title: string };

/** All projects of the merchant, newest change first; each can be deleted (its videos stay in the library). */
export function ProjectsPage() {
  const projects = useProjects();
  const del = useDeleteProject();
  const [target, setTarget] = useState<Row | null>(null);
  return (
    <section className="page-layout">
      <h1 className="text-2xl font-semibold">โปรเจกต์</h1>
      {projects.isPending ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="กำลังโหลด">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : projects.isError ? (
        <p role="alert" className="text-sm text-destructive">
          โหลดรายการโปรเจกต์ไม่สำเร็จ
        </p>
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="ยังไม่มีโปรเจกต์"
          hint="อัปโหลดวิดีโอในคลังวิดีโอ แล้วกด “สร้างคลิปอัตโนมัติ” หรือเลือกคำในคำถอดเสียงเพื่อสร้างคลิปเอง"
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card" aria-label="โปรเจกต์ทั้งหมด">
          {projects.data.map((p) => (
            <li key={p.id} data-testid="project-row" className="flex items-center gap-1 pr-2">
              <Link
                to={`/clips/${p.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                {p.createdBy === 'ai' ? (
                  <Sparkles className="size-4 shrink-0 text-accent-foreground" aria-label="สร้างอัตโนมัติ" />
                ) : (
                  <Clapperboard className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {formatTimecode(p.durationFrames, p.fps)}
                </span>
              </Link>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`ลบโปรเจกต์ ${p.title}`}
                data-testid="delete-project"
                onClick={() => setTarget({ id: p.id, title: p.title })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => {
          if (!o) {
            setTarget(null);
            del.reset();
          }
        }}
        title="ลบโปรเจกต์นี้?"
        confirmLabel="ลบโปรเจกต์"
        busy={del.isPending}
        onConfirm={() => target && del.mutate(target.id, { onSuccess: () => setTarget(null) })}
      >
        <p>“{target?.title}” ทุกเวอร์ชันและไฟล์ที่ส่งออกจะถูกลบถาวร วิดีโอต้นฉบับยังอยู่ในคลังวิดีโอ</p>
        {del.isError ? (
          <p className="text-destructive" role="alert">
            ลบไม่สำเร็จ ลองใหม่อีกครั้ง
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
