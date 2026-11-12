import { formatTimecode } from '@myvideo/timeline-core';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clapperboard, Library } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { addFolderSources, useAddFolderSources, useFolder } from '@/api/folders';
import { useProject } from '@/api/projects';
import { useLibrarySources, useSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceCard } from '@/features/library/SourceCard';
import { UploadPanel } from '@/features/upload/UploadPanel';

function FolderSource({ id }: { id: string }) {
  const source = useSource(id);
  return source.isPending ? (
    <Skeleton className="aspect-video" />
  ) : source.isError ? (
    <p role="alert">
      โหลดฟุตเทจไม่ได้{' '}
      <Button variant="ghost" onClick={() => source.refetch()}>
        ลองอีกครั้ง
      </Button>
    </p>
  ) : (
    <SourceCard source={source.data} />
  );
}

function FolderClip({ id }: { id: string }) {
  const clip = useProject(id);
  if (clip.isPending) return <Skeleton className="h-20" />;
  if (clip.isError)
    return (
      <p role="alert">
        โหลดคลิปไม่ได้{' '}
        <Button variant="ghost" onClick={() => clip.refetch()}>
          ลองอีกครั้ง
        </Button>
      </p>
    );
  return (
    <Link
      to={`/clips/${id}`}
      className="flex min-h-24 items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="edited-clip"
    >
      <Clapperboard className="size-6 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <h3 className="truncate font-medium">{clip.data.title}</h3>
        <p className="text-sm text-muted-foreground">
          {formatTimecode(clip.data.doc.durationFrames, clip.data.doc.fps)} · ดูและแก้ไขคลิป
        </p>
      </div>
    </Link>
  );
}

function LibraryPicker({
  folderId,
  existing,
  onDone,
}: {
  folderId: string;
  existing: string[];
  onDone: () => void;
}) {
  const sources = useLibrarySources();
  const items = sources.data?.pages.flatMap((page) => page.items) ?? [];
  const add = useAddFolderSources(folderId);
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <section aria-label="เลือกวิดีโอจากคลัง" className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <h3 className="font-medium">เลือกวิดีโอจากคลัง</h3>
      {sources.isPending ? (
        <Skeleton className="h-20" />
      ) : sources.isError && !sources.data ? (
        <p role="alert">
          โหลดคลังไม่ได้{' '}
          <Button variant="ghost" onClick={() => sources.refetch()}>
            ลองอีกครั้ง
          </Button>
        </p>
      ) : (
        <ul className="max-h-80 divide-y overflow-auto">
          {items
            .filter((source) => !existing.includes(source.id))
            .map((source) => (
              <li key={source.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${source.title}`}
                    data-source-id={source.id}
                    checked={selected.includes(source.id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked ? [...old, source.id] : old.filter((id) => id !== source.id),
                      )
                    }
                  />
                  <span className="truncate">{source.title}</span>
                </label>
              </li>
            ))}
          {items.every((source) => existing.includes(source.id)) ? (
            <li className="py-3 text-sm text-muted-foreground">ไม่มีวิดีโอให้เพิ่ม อัปโหลดไฟล์ใหม่ด้านล่างได้เลย</li>
          ) : null}
        </ul>
      )}
      {sources.isError && sources.data ? (
        <p role="alert" className="text-sm text-destructive">
          โหลดวิดีโอเพิ่มไม่สำเร็จ ลองอีกครั้ง
        </p>
      ) : null}
      {sources.hasNextPage ? (
        <Button variant="outline" disabled={sources.isFetching} onClick={() => sources.fetchNextPage()}>
          {sources.isFetchingNextPage ? 'กำลังโหลด…' : 'โหลดวิดีโอเพิ่ม'}
        </Button>
      ) : null}
      {add.isError ? (
        <p role="alert" className="text-sm text-destructive">
          เพิ่มวิดีโอไม่สำเร็จ ลองอีกครั้ง
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!selected.length || add.isPending}
          onClick={() => add.mutate(selected, { onSuccess: onDone })}
        >
          {add.isPending ? 'กำลังเพิ่ม…' : 'เพิ่มวิดีโอที่เลือก'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          ปิด
        </Button>
      </div>
    </section>
  );
}

export function ProjectFolderPage() {
  const { id = '' } = useParams();
  const folder = useFolder(id);
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  if (folder.isPending)
    return (
      <div className="page-layout">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  if (folder.isError) throw folder.error;
  const f = folder.data;
  return (
    <div className="page-layout">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/projects">
            <ArrowLeft aria-hidden />
            โปรเจกต์ทั้งหมด
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold break-words">{f.title}</h1>
      </header>
      <section aria-labelledby="footage-heading" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="footage-heading" className="text-xl font-semibold">
              ฟุตเทจต้นฉบับ
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">อัปโหลดเพิ่ม หรือเลือกวิดีโอที่มีอยู่ในคลัง</p>
          </div>
          <Button variant="outline" onClick={() => setPicking((open) => !open)} aria-expanded={picking}>
            <Library aria-hidden />
            เพิ่มจากคลังวิดีโอ
          </Button>
        </div>
        {picking ? (
          <LibraryPicker folderId={id} existing={f.sourceIds} onDone={() => setPicking(false)} />
        ) : null}
        <UploadPanel
          onSourceReady={async (sourceId) => {
            await addFolderSources(id, [sourceId]);
            await qc.invalidateQueries({ queryKey: ['folders'] });
          }}
        />
        {f.sourceIds.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="ฟุตเทจในโปรเจกต์">
            {f.sourceIds.map((sourceId) => (
              <li key={sourceId}>
                <FolderSource id={sourceId} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">ยังไม่มีฟุตเทจในโปรเจกต์นี้</p>
        )}
      </section>
      <section aria-labelledby="edited-heading" className="mt-8 space-y-5 border-t pt-8">
        <div>
          <h2 id="edited-heading" className="text-xl font-semibold">
            คลิปที่ตัดแล้ว
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">คลิปจากฟุตเทจในโปรเจกต์นี้ กดเพื่อดู แก้ไข หรือส่งออก</p>
        </div>
        {f.clipIds.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="คลิปที่ตัดแล้วในโปรเจกต์">
            {f.clipIds.map((clipId) => (
              <li key={clipId}>
                <FolderClip id={clipId} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/30 px-5 py-8 text-sm text-muted-foreground">
            ยังไม่มีคลิปที่ตัดแล้ว เปิดฟุตเทจแล้วเลือก “สร้างคลิปอัตโนมัติ” เพื่อเริ่มตัด
          </p>
        )}
      </section>
    </div>
  );
}
