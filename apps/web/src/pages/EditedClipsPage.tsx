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

/** Every editable clip, including those whose footage appears in multiple project folders. */
export function EditedClipsPage() {
  const clips = useProjects();
  const del = useDeleteProject();
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);
  return (
    <section className="page-layout">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">คลิปที่ตัดแล้ว</h1>
        <p className="text-sm text-muted-foreground">รวมคลิปจากทุกโปรเจกต์ เลือกคลิปเพื่อดู แก้ไข หรือส่งออก</p>
      </header>
      {clips.isPending ? (
        <Skeleton className="h-24 w-full" aria-label="กำลังโหลดคลิป…" />
      ) : clips.isError ? (
        <div role="alert">
          <p>โหลดคลิปไม่ได้</p>
          <Button variant="outline" onClick={() => clips.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : clips.data.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="ยังไม่มีคลิปที่ตัดแล้ว"
          hint="เพิ่มฟุตเทจในโปรเจกต์ แล้วสร้างคลิปอัตโนมัติ คลิปจะรวมอยู่ที่นี่"
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card" aria-label="คลิปที่ตัดแล้วทั้งหมด">
          {clips.data.map((clip) => (
            <li
              key={clip.id}
              className="flex items-center gap-2 pr-3 [content-visibility:auto]"
              data-testid="edited-clip-row"
            >
              <Link
                to={`/clips/${clip.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {clip.createdBy === 'ai' ? (
                  <Sparkles className="size-5 shrink-0 text-primary" aria-label="สร้างอัตโนมัติ" />
                ) : (
                  <Clapperboard className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{clip.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {formatTimecode(clip.durationFrames, clip.fps)}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`ลบคลิป ${clip.title}`}
                onClick={() => setTarget(clip)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            del.reset();
          }
        }}
        title="ลบคลิปนี้?"
        confirmLabel="ลบคลิป"
        busy={del.isPending}
        onConfirm={() => target && del.mutate(target.id, { onSuccess: () => setTarget(null) })}
      >
        <p>“{target?.title}” ทุกเวอร์ชันและไฟล์ส่งออกจะถูกลบ ฟุตเทจต้นฉบับยังอยู่ในคลังวิดีโอ</p>
        {del.isError ? (
          <p role="alert" className="text-destructive">
            ลบไม่สำเร็จ ลองอีกครั้ง
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
