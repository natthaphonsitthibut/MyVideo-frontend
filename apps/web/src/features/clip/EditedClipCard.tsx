import { formatTimecode, frameToSeconds } from '@myvideo/timeline-core';
import { Play } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useProject } from '@/api/projects';
import { spriteSheetUrl, useSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { spriteCoverStyle } from '@/features/library/sprite';

function Thumbnail({
  sourceId,
  time,
  ratio,
  title,
}: {
  sourceId: string;
  time: number;
  ratio: number;
  title: string;
}) {
  const source = useSource(sourceId);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const height = (width * 9) / 16;
  const w = Math.min(width, height * ratio);
  const h = w / ratio;
  const sprites = source.data?.sprites;
  return (
    <div ref={ref} className="flex aspect-video items-center justify-center overflow-hidden bg-black">
      {sprites ? (
        <div
          role="img"
          aria-label={`ภาพตัวอย่างคลิป ${title}`}
          style={{
            width: w,
            height: h,
            ...spriteCoverStyle((n) => spriteSheetUrl(sourceId, n), sprites, time, w, h),
          }}
        />
      ) : (
        <span className="px-4 text-center text-sm text-white">
          {source.isError ? 'โหลดภาพตัวอย่างไม่ได้' : 'กำลังเตรียมภาพตัวอย่าง…'}
        </span>
      )}
    </div>
  );
}

/** Uses footage at this clip's source time; no video decoders run in the collection. */
export function EditedClipCard({
  id,
  to = `/clips/${id}`,
  children,
}: {
  id: string;
  to?: string;
  children?: ReactNode;
}) {
  const project = useProject(id);
  if (project.isPending) return <Skeleton className="aspect-video rounded-xl" />;
  if (project.isError)
    return (
      <div role="alert" className="rounded-xl border p-4">
        <p>โหลดคลิปไม่ได้</p>
        <Button variant="ghost" onClick={() => project.refetch()}>
          ลองอีกครั้ง
        </Button>
      </div>
    );
  const { title, doc } = project.data;
  const first = Object.values(doc.elements)
    .filter((e) => e.type === 'video')
    .sort((a, b) => a.startFrame - b.startFrame)[0];
  const sourceId = first ? doc.assets[first.assetId]?.sourceId : undefined;
  const time = first
    ? frameToSeconds(
        first.sourceInFrame + Math.min(30, Math.floor(first.durationFrames / 2)) * first.playbackRate,
        doc.fps,
      )
    : 0;
  return (
    <article
      className="overflow-hidden rounded-xl border bg-card"
      data-testid="edited-clip-card"
      data-clip-id={id}
    >
      <Link
        to={to}
        aria-label={`เปิดคลิป ${title}`}
        className="relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sourceId ? (
          <Thumbnail sourceId={sourceId} time={time} ratio={doc.width / doc.height} title={title} />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-muted p-4 text-center text-sm">
            {title}
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="rounded-full bg-black/60 p-3 text-white">
            <Play className="size-6" />
          </span>
        </span>
        <span className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-xs text-white tabular-nums">
          {formatTimecode(doc.durationFrames, doc.fps)}
        </span>
      </Link>
      <div className="flex items-start gap-2 p-3">
        <Link
          to={to}
          className="min-w-0 flex-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="edited-clip"
        >
          <h3 className="truncate font-medium" title={title}>
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">ดู แก้ไข หรือส่งออกคลิป</p>
        </Link>
        {children}
      </div>
    </article>
  );
}
