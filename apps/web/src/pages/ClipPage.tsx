import type { StageProject } from '@myvideo/stage';
import { formatTimecode } from '@myvideo/timeline-core';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportPanel } from '@/features/export/ExportPanel';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';

/** Minimal clip page: title + preview of the saved project (editing comes with Quick Edit). */
export function ClipPage() {
  const { id = '' } = useParams();
  const project = useProject(id);
  if (project.isPending) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดคลิป">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mx-auto aspect-[9/16] h-[min(70vh,720px)] rounded-xl" />
      </div>
    );
  }
  if (project.isError) throw project.error;
  const rec = project.data;
  const doc = rec.doc;
  const sourceId = Object.values(doc.assets)[0]?.sourceId;
  return (
    <section className="mx-auto w-full max-w-md space-y-4">
      <div className="space-y-2">
        {sourceId ? (
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to={`/library/${sourceId}`}>
              <ArrowLeft />
              วิดีโอต้นฉบับ
            </Link>
          </Button>
        ) : null}
        <h1 className="text-xl font-semibold break-words" data-testid="clip-title">
          {rec.title}
        </h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          ความยาว {formatTimecode(doc.durationFrames, doc.fps)} · แนวตั้ง 9:16 · เวอร์ชัน {rec.version}
        </p>
      </div>
      <PreviewPlayer project={doc as unknown as StageProject} />
      <ExportPanel projectId={rec.id} version={rec.version} />
    </section>
  );
}
