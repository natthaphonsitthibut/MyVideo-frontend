import { useQueryClient } from '@tanstack/react-query';
import { Library } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { addFolderSources, useAddFolderSources, useFolder } from '@/api/folders';
import { useLibrarySources, useSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { PageBackLink } from '@/components/ui/page-back-link';
import { Skeleton } from '@/components/ui/skeleton';
import { EditedClipCard } from '@/features/clip/EditedClipCard';
import { SourceCard } from '@/features/library/SourceCard';
import { FolderSettingsPanel } from '@/features/project/FolderSettingsPanel';
import { PlanPanel } from '@/features/project/PlanPanel';
import { UploadPanel } from '@/features/upload/UploadPanel';

function FolderSource({
  id,
  folderId,
  selected,
  onSelect,
}: {
  id: string;
  folderId: string;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}) {
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
    <div className="space-y-2">
      <SourceCard source={source.data} to={`/library/${id}?project=${folderId}`} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`ส่ง ${source.data.title} ให้ AI`}
        />
        ใช้ตัดต่อรอบถัดไป
      </label>
    </div>
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
  const [selection, setSelection] = useState<{ folderId: string; ids: string[] } | null>(null);
  if (folder.isPending)
    return (
      <div className="page-layout">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  if (folder.isError) throw folder.error;
  const f = folder.data;
  const selectedIds =
    selection?.folderId === id ? selection.ids.filter((s) => f.sourceIds.includes(s)) : f.sourceIds;
  const select = (sourceId: string, checked: boolean) =>
    setSelection({
      folderId: id,
      ids: checked ? [...new Set([...selectedIds, sourceId])] : selectedIds.filter((s) => s !== sourceId),
    });
  return (
    <div className="page-layout">
      <header className="space-y-3">
        <PageBackLink to="/projects">โปรเจกต์ทั้งหมด</PageBackLink>
        <h1 className="text-2xl font-semibold break-words">{f.title}</h1>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="footage-heading" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="footage-heading" className="text-xl font-semibold">
                ฟุตเทจต้นฉบับ
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">วิดีโอและรูปสินค้า อัปโหลดเพิ่ม หรือเลือกจากคลังที่มีอยู่</p>
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
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p aria-live="polite">
                ส่งให้ AI {selectedIds.length}/{f.sourceIds.length} ไฟล์
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelection({ folderId: id, ids: f.sourceIds })}
              >
                เลือกทั้งหมด
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelection({ folderId: id, ids: [] })}>
                ล้างการเลือก
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                ไฟล์ที่ไม่เลือกยังอยู่ในโปรเจกต์ การเลือกนี้ใช้เมื่อเริ่มตัดต่อรอบถัดไป
              </p>
            </div>
          ) : null}
          {f.sourceIds.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="ฟุตเทจในโปรเจกต์">
              {f.sourceIds.map((sourceId) => (
                <li key={sourceId}>
                  <FolderSource
                    id={sourceId}
                    folderId={id}
                    selected={selectedIds.includes(sourceId)}
                    onSelect={(checked) => select(sourceId, checked)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">ยังไม่มีฟุตเทจในโปรเจกต์นี้</p>
          )}
        </section>
        <aside className="space-y-6 lg:sticky lg:top-6">
          <FolderSettingsPanel folderId={id} settings={f.settings} sourceIds={f.sourceIds} />
          <PlanPanel folderId={id} sourceIds={selectedIds} />
        </aside>
      </div>
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
                <EditedClipCard id={clipId} to={`/clips/${clipId}?project=${id}`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/30 px-5 py-8 text-sm text-muted-foreground">
            ยังไม่มีคลิปที่ตัดแล้ว กด “เริ่มตัดต่อ” ในแผนงาน แล้วคลิปจะมาอยู่ที่นี่
          </p>
        )}
      </section>
    </div>
  );
}
