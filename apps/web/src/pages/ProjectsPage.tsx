import { Folder, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCreateFolder, useDeleteFolder, useFolders } from '@/api/folders';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

export function ProjectsPage() {
  const folders = useFolders();
  const create = useCreateFolder();
  const del = useDeleteFolder();
  const navigate = useNavigate();
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);
  return (
    <section className="page-layout">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">โปรเจกต์</h1>
        <p className="text-sm text-muted-foreground">จัดฟุตเทจและคลิปที่ตัดแล้วไว้ด้วยกันในแต่ละโปรเจกต์</p>
      </header>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = String(new FormData(e.currentTarget).get('title') ?? '').trim();
          if (title) create.mutate(title, { onSuccess: (folder) => navigate(`/projects/${folder.id}`) });
        }}
      >
        <label htmlFor="project-title" className="text-sm font-medium">
          ชื่อโปรเจกต์
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="project-title"
            name="title"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="เช่น คอลเลกชันเสื้อใหม่…"
            className="sm:max-w-md"
          />
          <Button type="submit" disabled={create.isPending}>
            <Plus aria-hidden />
            {create.isPending ? 'กำลังสร้าง…' : 'สร้างโปรเจกต์'}
          </Button>
        </div>
        {create.isError ? (
          <p role="alert" className="text-sm text-destructive">
            สร้างโปรเจกต์ไม่สำเร็จ ลองอีกครั้ง
          </p>
        ) : null}
      </form>
      {folders.isPending ? (
        <Skeleton className="h-24 w-full" aria-label="กำลังโหลดโปรเจกต์…" />
      ) : folders.isError ? (
        <div role="alert">
          <p>โหลดโปรเจกต์ไม่ได้</p>
          <Button variant="outline" onClick={() => folders.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : folders.data.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="สร้างโปรเจกต์แรกของคุณ"
          hint="ตั้งชื่อด้านบน แล้วอัปโหลดฟุตเทจหรือเลือกวิดีโอที่มีอยู่ในคลัง"
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="โปรเจกต์ทั้งหมด">
          {folders.data.map((folder) => (
            <li
              key={folder.id}
              className="relative rounded-xl border bg-card [content-visibility:auto]"
              data-testid="project-row"
            >
              <Link
                to={`/projects/${folder.id}`}
                className="flex min-h-36 flex-col gap-4 rounded-xl p-5 pr-12 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Folder className="size-7 text-primary" aria-hidden />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{folder.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {folder.sourceIds.length} ฟุตเทจ · {folder.clipIds.length} คลิปที่ตัดแล้ว
                  </p>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3"
                aria-label={`ลบโปรเจกต์ ${folder.title}`}
                onClick={() => setTarget(folder)}
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
        title="ลบโปรเจกต์นี้?"
        confirmLabel="ลบโปรเจกต์"
        busy={del.isPending}
        onConfirm={() => target && del.mutate(target.id, { onSuccess: () => setTarget(null) })}
      >
        <p>ลบโฟลเดอร์ “{target?.title}” ฟุตเทจยังอยู่ในคลังวิดีโอ และคลิปที่ตัดแล้วจะยังเปิดได้จากฟุตเทจต้นทาง</p>
        {del.isError ? (
          <p role="alert" className="text-destructive">
            ลบไม่สำเร็จ ลองใหม่อีกครั้ง
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
