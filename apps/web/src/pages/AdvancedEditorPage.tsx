import type { Player, Stage, StageElement, StageProject } from '@myvideo/stage';
import { addTrack, type Command } from '@myvideo/timeline-core';
import { Music, PictureInPicture2, Plus, Redo2, Type, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { type ProjectRecord, useProject } from '@/api/projects';
import { useSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { PageBackLink } from '@/components/ui/page-back-link';
import { SaveStatus } from '@/components/ui/save-status';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clipOrigin } from '@/features/clip/navigation';
import { addTextElement } from '@/features/editor/text-elements';
import { useEditorMeta, useEditorStore } from '@/features/editor/use-editor';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';
import { addMediaFromSource } from '@/features/timeline/add-media';
import { PropertiesPanel } from '@/features/timeline/PropertiesPanel';
import { refusal, Timeline } from '@/features/timeline/Timeline';
import { VersionsPanel } from '@/features/timeline/VersionsPanel';

const reload = () => window.location.reload();

/** What forces a stage remount: track order/flags, the asset set and the length (elements are patched by id). */
function structureKey(doc: StageProject): string {
  return JSON.stringify([
    doc.durationFrames,
    doc.tracks.map((t) => [t.id, t.kind, t.locked, t.muted]),
    Object.keys(doc.assets).sort(),
  ]);
}

/**
 * Advanced editor (E09): multi-track timeline + properties + version history, behind the "ขั้นสูง" switch of Quick
 * Edit. Same document store (commands, undo/redo, autosave) and the same stage as every other preview.
 */
export function AdvancedEditorPage() {
  const { id = '' } = useParams();
  const project = useProject(id);
  if (project.isPending)
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="กำลังโหลดคลิป">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (project.isError) throw project.error;
  return <Advanced record={project.data} />;
}

function Advanced({ record }: { record: ProjectRecord }) {
  const origin = clipOrigin(useLocation().search);
  const store = useEditorStore(record);
  const { status, canUndo, canRedo } = useEditorMeta(store);
  const [mounted, setMounted] = useState(() => record.doc as unknown as StageProject);
  const keyRef = useRef(structureKey(mounted));
  const stageRef = useRef<Stage | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [ripple, setRipple] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sources = useSources();
  const onStage = useCallback((s: Stage | null) => {
    stageRef.current = s;
  }, []);
  const onPlayer = useCallback((p: Player | null) => {
    playerRef.current = p;
  }, []);

  useEffect(
    () =>
      store.subscribe((ids) => {
        const doc = store.doc() as unknown as StageProject;
        const key = structureKey(doc);
        if (key !== keyRef.current) {
          keyRef.current = key;
          setMounted(structuredClone(doc));
          return;
        }
        const stage = stageRef.current;
        if (!stage) return;
        for (const elId of ids) stage.patch(elId, (doc.elements[elId] as StageElement | undefined) ?? null);
      }),
    [store],
  );

  // space = play/pause, ⌘Z / ⇧⌘Z (never while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      )
        return;
      if (e.key === ' ') {
        e.preventDefault();
        const p = playerRef.current;
        void (p?.playing ? p.pause() : p?.play());
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const run = (cmd: Command) => {
    try {
      store.run(cmd);
      setMessage(null);
    } catch (err) {
      setMessage(refusal(err));
    }
  };
  const at = () => playerRef.current?.frame ?? 0;
  const ready = (sources.data?.items ?? []).filter((s) => s.status === 'ready');
  const addFromSource = (as: 'music' | 'overlay', sourceId: string) => {
    const s = ready.find((x) => x.id === sourceId);
    if (!s) return;
    run(
      addMediaFromSource({
        as,
        source: { id: s.id, durationMs: s.durationMs ?? 0, hasAudio: Boolean(s.hasAudio) },
        at: at(),
        ids: { asset: crypto.randomUUID(), element: crypto.randomUUID(), track: crypto.randomUUID() },
      }),
    );
  };
  const saveState = status === 'error' ? 'error' : status === 'saved' ? 'saved' : 'saving';
  const single = selected.length === 1 ? selected[0] : undefined;

  return (
    <section
      data-theme="editor"
      className="-mx-page -my-6 min-h-dvh bg-background px-page py-4 text-foreground"
      aria-label="แก้คลิปขั้นสูง"
      data-testid="advanced-editor"
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <PageBackLink to={`/clips/${record.id}/edit${origin.search}`}>แก้แบบง่าย</PageBackLink>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{record.title}</h1>
        <SaveStatus state={saveState} onRetry={() => void store.retry()} />
        <Button
          size="icon"
          variant="secondary"
          onClick={() => store.undo()}
          disabled={!canUndo}
          aria-label="ย้อนกลับ (⌘Z)"
        >
          <Undo2 />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => store.redo()}
          disabled={!canRedo}
          aria-label="ทำซ้ำ (⇧⌘Z)"
        >
          <Redo2 />
        </Button>
      </header>
      <div className="mb-3 grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <PreviewPlayer
          key={structureKey(mounted)}
          project={mounted}
          onStage={onStage}
          onPlayer={onPlayer}
          frameClassName="h-[min(48vh,560px)]"
        />
        <Tabs defaultValue="props" className="min-w-0">
          <TabsList aria-label="แผงขั้นสูง">
            <TabsTrigger value="props">คุณสมบัติ</TabsTrigger>
            <TabsTrigger value="add">เพิ่ม</TabsTrigger>
            <TabsTrigger value="history">ประวัติ</TabsTrigger>
          </TabsList>
          <TabsContent value="props">
            {single ? (
              <PropertiesPanel
                key={single}
                store={store}
                id={single}
                playerRef={playerRef}
                onMessage={setMessage}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {selected.length > 1
                  ? `เลือกอยู่ ${selected.length} ชิ้น — ลบ (Delete) หรือทำซ้ำ (⌘D) พร้อมกันได้`
                  : 'คลิกคลิปบนไทม์ไลน์เพื่อแก้ค่า'}
              </p>
            )}
          </TabsContent>
          <TabsContent value="add">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    run(
                      addTextElement({
                        id: crypto.randomUUID(),
                        trackId: crypto.randomUUID(),
                        at: at(),
                        text: 'ข้อความใหม่',
                      }),
                    )
                  }
                  data-testid="add-text-adv"
                >
                  <Type />
                  ข้อความ
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => run(addTrack({ id: crypto.randomUUID(), kind: 'overlay' }))}
                  data-testid="add-overlay-track"
                >
                  <Plus />
                  แทร็กซ้อนภาพ
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => run(addTrack({ id: crypto.randomUUID(), kind: 'audio' }))}
                >
                  <Plus />
                  แทร็กเสียง
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Music className="size-4" aria-hidden />
                <span className="w-28">เพลง/เสียงจากวิดีโอของคุณ</span>
                <select
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2"
                  value=""
                  onChange={(e) => addFromSource('music', e.target.value)}
                  data-testid="add-music"
                >
                  <option value="">เลือกวิดีโอ…</option>
                  {ready
                    .filter((s) => s.hasAudio)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <PictureInPicture2 className="size-4" aria-hidden />
                <span className="w-28">ภาพซ้อน (วิดีโอเล็กมุมจอ)</span>
                <select
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2"
                  value=""
                  onChange={(e) => addFromSource('overlay', e.target.value)}
                  data-testid="add-overlay"
                >
                  <option value="">เลือกวิดีโอ…</option>
                  {ready.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                ใช้เฉพาะวิดีโอ/เพลงที่คุณมีสิทธิ์ใช้ เพลงจะเริ่มที่ตำแหน่งหัวเล่น — เลือกคลิปเพลงแล้วกด “ลดเสียงเพลงตอนคนพูด”
                ในแท็บคุณสมบัติ
              </p>
            </div>
          </TabsContent>
          <TabsContent value="history">
            <VersionsPanel
              projectId={record.id}
              baseVersion={() => store.version()}
              beforeRestore={() => store.flush()}
              onRestored={reload}
            />
          </TabsContent>
        </Tabs>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={ripple}
            onChange={(e) => setRipple(e.target.checked)}
            data-testid="ripple-toggle"
          />
          ตัดท้ายแล้วเลื่อนคลิปถัดไปมาชิด (ripple)
        </label>
        {message ? (
          <span className="text-destructive" role="alert" data-testid="timeline-message">
            {message}
          </span>
        ) : null}
      </div>
      <Timeline
        store={store}
        playerRef={playerRef}
        selected={selected}
        onSelect={setSelected}
        ripple={ripple}
        onMessage={setMessage}
      />
    </section>
  );
}
