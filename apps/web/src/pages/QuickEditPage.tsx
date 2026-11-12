import type { Player, Stage, StageElement, StageProject } from '@myvideo/stage';
import { ArrowLeft, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { type ProjectRecord, useProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { SaveStatus } from '@/components/ui/save-status';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaptionsPanel } from '@/features/editor/CaptionsPanel';
import { ReframePanel } from '@/features/editor/ReframePanel';
import { StylePanel } from '@/features/editor/StylePanel';
import { TextsPanel } from '@/features/editor/TextsPanel';
import { useEditorMeta, useEditorStore } from '@/features/editor/use-editor';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';

/**
 * Quick Edit (E08): fix an AI clip in about a minute — preview on the left, a few plain panels on the right, no
 * timeline. Every change is a command (undo/redo), patches the mounted stage in place and is autosaved.
 */
export function QuickEditPage() {
  const { id = '' } = useParams();
  const project = useProject(id);
  if (project.isPending) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดคลิป">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-[9/16] h-[min(70vh,720px)] rounded-xl" />
      </div>
    );
  }
  if (project.isError) throw project.error;
  return <Editor record={project.data} />;
}

function Editor({ record }: { record: ProjectRecord }) {
  const store = useEditorStore(record);
  const { status, canUndo, canRedo } = useEditorMeta(store);
  // the stage is mounted once from the opened version; later edits patch it element by element
  const initial = useRef(record.doc as unknown as StageProject).current;
  const stageRef = useRef<Stage | null>(null);
  const onStage = useCallback((s: Stage | null) => {
    stageRef.current = s;
  }, []);
  const playerRef = useRef<Player | null>(null);
  const onPlayer = useCallback((p: Player | null) => {
    playerRef.current = p;
  }, []);
  useEffect(
    () =>
      store.subscribe((ids) => {
        const stage = stageRef.current;
        if (!stage) return;
        const doc = store.doc();
        for (const elId of ids) stage.patch(elId, (doc.elements[elId] as StageElement | undefined) ?? null);
      }),
    [store],
  );
  // ⌘Z / ⇧⌘Z (not while typing in a field: the browser's own undo applies there)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const saveState = status === 'error' ? 'error' : status === 'saved' ? 'saved' : 'saving';
  return (
    <section
      data-theme="editor"
      className="-mx-page -my-6 min-h-dvh bg-background px-page py-4 text-foreground"
      aria-label="แก้คลิป"
      data-testid="quick-edit"
    >
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/clips/${record.id}`}>
            <ArrowLeft />
            กลับ
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" data-testid="edit-title">
          {record.title}
        </h1>
        <div data-testid="save-status" data-state={status}>
          <SaveStatus state={saveState} onRetry={() => void store.retry()} />
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            onClick={() => store.undo()}
            disabled={!canUndo}
            aria-label="ย้อนกลับ (⌘Z)"
            data-testid="undo"
          >
            <Undo2 />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => store.redo()}
            disabled={!canRedo}
            aria-label="ทำซ้ำ (⇧⌘Z)"
            data-testid="redo"
          >
            <Redo2 />
          </Button>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <PreviewPlayer
          project={initial}
          onStage={onStage}
          onPlayer={onPlayer}
          frameClassName="h-[min(72vh,760px)]"
        />
        <Tabs defaultValue="captions" className="min-w-0">
          <TabsList aria-label="สิ่งที่แก้ได้">
            <TabsTrigger value="captions">คำบรรยาย</TabsTrigger>
            <TabsTrigger value="style">สไตล์</TabsTrigger>
            <TabsTrigger value="crop">ครอบภาพ</TabsTrigger>
            <TabsTrigger value="texts">ข้อความ</TabsTrigger>
          </TabsList>
          <TabsContent value="crop">
            <ReframePanel
              store={store}
              sourceId={Object.values(initial.assets).find((a) => a.sourceId)?.sourceId}
              frame={{ width: initial.width, height: initial.height }}
            />
          </TabsContent>
          <TabsContent value="style">
            <StylePanel store={store} canvasWidth={initial.width} />
          </TabsContent>
          <TabsContent value="captions">
            <CaptionsPanel
              store={store}
              canvasWidth={initial.width}
              onSeek={(f) => void playerRef.current?.seek(f)}
            />
          </TabsContent>
          <TabsContent value="texts">
            <TextsPanel store={store} playhead={() => playerRef.current?.frame ?? 0} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
