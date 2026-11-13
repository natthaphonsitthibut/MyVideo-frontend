import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Pause, Play, RotateCw, Upload, X } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { ApiError, api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type MediaKind, mediaKind } from '../library/media-kind';
import { formatBytes, type UnfinishedUpload, type UploadItem, UploadManager } from './upload-manager';

let manager: UploadManager | undefined;
let onReady: (id: string) => void = () => {};
function getManager(): UploadManager {
  manager ??= new UploadManager((id) => onReady(id));
  return manager;
}

function useUploadConfig() {
  return useQuery({
    queryKey: ['upload-config'],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/sources/upload-config');
      if (!data) throw new ApiError(response.status, error);
      return data;
    },
  });
}

const STATUS_LABEL: Record<UploadItem['status'], string> = {
  uploading: 'กำลังอัปโหลด',
  retrying: 'เชื่อมต่อหลุด กำลังลองต่อ…',
  paused: 'หยุดไว้',
  finishing: 'กำลังส่งเข้าคิวประมวลผล',
  done: 'อัปโหลดเสร็จ — กำลังประมวลผล',
  error: 'อัปโหลดไม่สำเร็จ',
};

function UploadRow({ item, mgr }: { item: UploadItem; mgr: UploadManager }) {
  const pct = item.size ? Math.round((item.sent / item.size) * 100) : 0;
  const active = item.status === 'uploading' || item.status === 'retrying';
  return (
    <li className="space-y-2 py-3" data-testid="upload-row" data-status={item.status}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate font-medium" title={item.name}>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {item.status === 'error' && item.sent === 0
              ? formatBytes(item.size)
              : `${formatBytes(item.sent)} / ${formatBytes(item.size)}`}{' '}
            · {STATUS_LABEL[item.status]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {active ? (
            <Button variant="ghost" size="sm" onClick={() => mgr.pause(item.id)}>
              <Pause />
              หยุด
            </Button>
          ) : null}
          {item.status === 'paused' || (item.status === 'error' && item.sent > 0) ? (
            <Button variant="outline" size="sm" onClick={() => mgr.resume(item.id)}>
              {item.status === 'paused' ? <Play /> : <RotateCw />}
              อัปโหลดต่อ
            </Button>
          ) : null}
          {item.status === 'done' && item.sourceId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/library/${item.sourceId}`}>ดูความคืบหน้า</Link>
            </Button>
          ) : null}
          {item.status !== 'finishing' ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`เอา ${item.name} ออก`}
              onClick={() => mgr.remove(item.id)}
            >
              <X />
            </Button>
          ) : null}
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`อัปโหลด ${item.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full origin-left rounded-full transition-transform duration-200 ease-out',
            item.status === 'error'
              ? 'bg-destructive'
              : item.status === 'done'
                ? 'bg-success'
                : item.status === 'paused'
                  ? 'bg-muted-foreground/40'
                  : 'bg-primary',
          )}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      {item.error ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {item.error}
        </p>
      ) : null}
      {item.status === 'done' ? (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          วิดีโออยู่ในคลังแล้ว ระบบกำลังทำพรีวิวและภาพตัวอย่าง
        </p>
      ) : null}
    </li>
  );
}

export function UploadPanel({
  onSourceReady,
  kind,
}: {
  onSourceReady?: (sourceId: string) => Promise<void>;
  kind?: MediaKind;
} = {}) {
  const qc = useQueryClient();
  const cfg = useUploadConfig();
  const mgr = getManager();
  const allItems = useSyncExternalStore(mgr.subscribe, mgr.getSnapshot);
  const items = kind ? allItems.filter((i) => mediaKind({ originalFilename: i.name }) === kind) : allItems;
  const uploadConfig = cfg.data
    ? {
        ...cfg.data,
        extensions: cfg.data.extensions.filter(
          (e) => !kind || mediaKind({ originalFilename: `file.${e}` }) === kind,
        ),
      }
    : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [unfinished, setUnfinished] = useState<UnfinishedUpload[]>([]);

  useEffect(() => {
    onReady = () => {
      void qc.invalidateQueries({ queryKey: ['sources'] });
      void qc.invalidateQueries({ queryKey: ['workflow-runs'] });
    };
  }, [qc]);

  // uploads from an earlier visit that never finished (re-picking the same file resumes them)
  const activeNames = useMemo(() => new Set(items.map((i) => `${i.name}:${i.size}`)), [items]);
  useEffect(() => {
    void UploadManager.unfinished().then(setUnfinished);
  }, []);
  const leftovers = unfinished.filter(
    (u) =>
      !activeNames.has(`${u.name}:${u.size}`) && (!kind || mediaKind({ originalFilename: u.name }) === kind),
  );

  const addFiles = (files: FileList | null) => {
    if (!files || !uploadConfig) return;
    for (const f of Array.from(files)) void mgr.add(f, uploadConfig, onSourceReady);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* drop target for mouse users; keyboard and touch users use the button inside */}
      <section
        aria-label={kind === 'photo' ? 'อัปโหลดรูปสินค้า' : kind === 'video' ? 'อัปโหลดวิดีโอ' : 'อัปโหลดวิดีโอหรือรูป'}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
        )}
      >
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">
            {kind === 'photo'
              ? 'ลากรูปสินค้ามาวางที่นี่'
              : kind === 'video'
                ? 'ลากวิดีโอมาวางที่นี่'
                : 'ลากวิดีโอหรือรูปสินค้ามาวางที่นี่'}
          </p>
          <p className="text-sm text-muted-foreground">
            เลือกหลายไฟล์พร้อมกันได้ อัปโหลดต่อได้ถ้าเน็ตหลุด
            {uploadConfig
              ? ` · สูงสุด ${formatBytes(uploadConfig.maxBytes)} · ${uploadConfig.extensions.join(', ')}`
              : ''}
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={!cfg.data}>
          เลือกไฟล์
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={
            uploadConfig
              ? uploadConfig.extensions.map((e) => `.${e}`).join(',')
              : kind === 'photo'
                ? 'image/*'
                : 'video/*'
          }
          multiple
          className="sr-only"
          data-testid="upload-input"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </section>
      {leftovers.length ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">มีไฟล์ที่อัปโหลดค้างไว้</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {leftovers.map((u) => (
              <li key={u.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {u.name} ({formatBytes(u.size)}) — เลือกไฟล์เดิมอีกครั้งเพื่ออัปโหลดต่อจากจุดเดิม
                </span>
                <button
                  type="button"
                  className="text-xs underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    void UploadManager.forget(u.key).then(() =>
                      setUnfinished((xs) => xs.filter((x) => x.key !== u.key)),
                    )
                  }
                >
                  ไม่ต้องการแล้ว
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {items.length ? (
        <ul className="divide-y rounded-xl border bg-card px-4" aria-label="รายการอัปโหลด">
          {items.map((it) => (
            <UploadRow key={it.id} item={it} mgr={mgr} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
