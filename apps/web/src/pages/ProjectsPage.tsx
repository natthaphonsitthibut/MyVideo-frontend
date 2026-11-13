import { Folder, Plus, Search, Trash2, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
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
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const query = search.trim().normalize('NFC').toLocaleLowerCase('th');
  const visible = (folders.data ?? []).filter((f) =>
    f.title.normalize('NFC').toLocaleLowerCase('th').includes(query),
  );
  return (
    <section className="page-layout">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">โปรเจกต์</h1>
        <p className="text-sm text-muted-foreground">จัดฟุตเทจและคลิปที่ตัดแล้วไว้ด้วยกันในแต่ละโปรเจกต์</p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <label htmlFor="project-search" className="sr-only">
            ค้นหาโปรเจกต์
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="project-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาโปรเจกต์…"
            autoComplete="off"
            className="pl-10"
          />
        </div>
        <Dialog.Root
          open={creating}
          onOpenChange={(open) => {
            if (create.isPending) return;
            setCreating(open);
            if (open) {
              setTitle('');
              create.reset();
            }
          }}
        >
          <Dialog.Trigger asChild>
            <Button>
              <Plus aria-hidden />
              สร้างโปรเจกต์
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-lg motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:zoom-in-95">
              <div className="flex items-center justify-between gap-3">
                <Dialog.Title className="text-lg font-semibold">สร้างโปรเจกต์ใหม่</Dialog.Title>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="ปิด" disabled={create.isPending}>
                    <X aria-hidden />
                  </Button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="text-sm text-muted-foreground">
                ตั้งชื่อโปรเจกต์ แล้วเพิ่มวิดีโอหรือรูปเพื่อเริ่มตัดต่อ
              </Dialog.Description>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim() && !create.isPending)
                    create.mutate(title.trim(), {
                      onSuccess: (folder) => {
                        setCreating(false);
                        navigate(`/projects/${folder.id}`);
                      },
                    });
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="project-title" className="text-sm font-medium">
                    ชื่อโปรเจกต์
                  </label>
                  <Input
                    id="project-title"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={200}
                    autoComplete="off"
                    placeholder="เช่น คอลเลกชันเสื้อใหม่…"
                    disabled={create.isPending}
                  />
                </div>
                {create.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    สร้างโปรเจกต์ไม่สำเร็จ ลองอีกครั้ง
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button type="button" variant="outline" disabled={create.isPending}>
                      ยกเลิก
                    </Button>
                  </Dialog.Close>
                  <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
                    สร้างโปรเจกต์
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
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
          hint="กดสร้างโปรเจกต์ แล้วอัปโหลดฟุตเทจหรือเลือกวิดีโอที่มีอยู่ในคลัง"
        />
      ) : visible.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={Search}
            title="ไม่พบโปรเจกต์ที่ตรงกับคำค้นหา"
            hint="ลองค้นหาด้วยชื่ออื่น หรือล้างคำค้นหาเพื่อดูทั้งหมด"
          />
          <Button variant="outline" onClick={() => setSearch('')}>
            ล้างคำค้นหา
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="โปรเจกต์ทั้งหมด">
          {visible.map((folder) => (
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
