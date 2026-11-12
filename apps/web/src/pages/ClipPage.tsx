import type { StageProject } from '@myvideo/stage';
import { formatTimecode } from '@myvideo/timeline-core';
import { Pencil } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { useProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { PageBackLink } from '@/components/ui/page-back-link';
import { Skeleton } from '@/components/ui/skeleton';
import { clipOrigin } from '@/features/clip/navigation';
import { ExportPanel } from '@/features/export/ExportPanel';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';

/** Minimal clip page: title + preview of the saved project (editing comes with Quick Edit). */
export function ClipPage() {
  const { id = '' } = useParams();
  const origin = clipOrigin(useLocation().search);
  const project = useProject(id);
  if (project.isPending) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดคลิป">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[405px] rounded-xl" />
      </div>
    );
  }
  if (project.isError) throw project.error;
  const rec = project.data;
  const doc = rec.doc;
  return (
    <section className="page-layout">
      <header className="space-y-3">
        <PageBackLink to={origin.to}>{origin.label}</PageBackLink>
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold break-words" data-testid="clip-title">
            {rec.title}
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            ความยาว {formatTimecode(doc.durationFrames, doc.fps)} · {doc.width}×{doc.height} · เวอร์ชัน{' '}
            {rec.version}
          </p>
        </div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <PreviewPlayer project={doc as unknown as StageProject} />
        <aside className="flex flex-col gap-4" aria-label="จัดการคลิป">
          <Button asChild className="w-full" data-testid="open-editor">
            <Link to={`/clips/${rec.id}/edit${origin.search}`}>
              <Pencil aria-hidden />
              แก้คลิป
            </Link>
          </Button>
          <ExportPanel projectId={rec.id} version={rec.version} />
        </aside>
      </div>
    </section>
  );
}
