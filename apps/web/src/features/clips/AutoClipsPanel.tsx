import type { StageProject } from '@myvideo/stage';
import { CircleAlert, Pencil, Play, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '@/api/client';
import {
  CLIP_TYPE_LABEL,
  type ClipSuggestion,
  clipsActive,
  useBuildClips,
  useClips,
  useDiscardClip,
  useGenerateClips,
} from '@/api/clips';
import { useProject } from '@/api/projects';
import { formatDuration, type SourceSummary, spriteSheetUrl } from '@/api/sources';
import { useTranscriptState } from '@/api/transcripts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { spriteCoverStyle } from '@/features/library/sprite';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';
import { clipHeading, clipsPanelView, rulesReason } from './labels';
import { StyleChooser } from './StyleChooser';

function ClipThumb({ source, clip }: { source: SourceSummary; clip: ClipSuggestion }) {
  const idx = source.sprites;
  const w = 96;
  const h = (w * 16) / 9;
  if (!idx) return <div className="aspect-[9/16] w-24 shrink-0 rounded-md bg-muted" />;
  const t = clip.startMs / 1000 + Math.min(2, (clip.endMs - clip.startMs) / 2000);
  return (
    <div
      aria-hidden
      data-testid="clip-thumb"
      className="shrink-0 overflow-hidden rounded-md bg-muted bg-no-repeat"
      style={{ width: w, height: h, ...spriteCoverStyle((n) => spriteSheetUrl(source.id, n), idx, t, w, h) }}
    />
  );
}

function ClipPreview({ projectId }: { projectId: string }) {
  const p = useProject(projectId);
  if (p.isPending) return <Skeleton className="mx-auto aspect-[9/16] h-[420px] rounded-xl" />;
  if (p.isError) return <p className="text-sm text-destructive">โหลดตัวอย่างไม่สำเร็จ</p>;
  return (
    <div className="mx-auto w-full max-w-sm" data-testid="clip-preview">
      <PreviewPlayer project={p.data.doc as unknown as StageProject} frameClassName="h-[min(60vh,560px)]" />
    </div>
  );
}

function ClipCard({
  source,
  clip,
  previewing,
  onPreview,
  onDiscard,
  discarding,
  waitingForStyle,
  clipSearch,
}: {
  source: SourceSummary;
  clip: ClipSuggestion;
  waitingForStyle: boolean;
  clipSearch: string;
  previewing: boolean;
  onPreview: (on: boolean) => void;
  onDiscard: () => void;
  discarding: boolean;
}) {
  const sec = Math.round((clip.endMs - clip.startMs) / 1000);
  return (
    <li
      className="rounded-xl border bg-card p-3"
      data-testid="clip-card"
      data-status={clip.status}
      data-rank={clip.rank}
    >
      <div className="flex gap-3">
        <ClipThumb source={source} clip={clip} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary tabular-nums">
              คะแนน {Math.round(clip.score)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              {CLIP_TYPE_LABEL[clip.type] ?? clip.type}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {sec} วิ · เริ่ม {formatDuration(clip.startMs)}
            </span>
          </div>
          <p className="font-medium break-words" data-testid="clip-title">
            {clipHeading(clip)}
          </p>
          {clip.hook ? <p className="text-sm break-words">“{clip.hook}”</p> : null}
          {clip.quote ? (
            <p className="text-sm text-muted-foreground break-words">คนขายพูดว่า: “{clip.quote}”</p>
          ) : null}
          <p className="text-xs text-muted-foreground break-words" data-testid="clip-reason">
            {clip.origin === 'rules' ? `เจอ: ${rulesReason(clip.reason)}` : clip.reason}
          </p>
          {clip.status === 'planned' ? (
            <p className="text-sm text-muted-foreground" role="status">
              {waitingForStyle ? 'รอเลือกสไตล์ก่อนตัดต่อ' : 'กำลังตัดต่อคลิปนี้…'}
            </p>
          ) : null}
          {clip.status === 'failed' ? (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <CircleAlert className="size-4" aria-hidden />
              {clip.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {clip.status === 'ready' && clip.projectId ? (
              <>
                <Button size="sm" variant="outline" onClick={() => onPreview(!previewing)}>
                  {previewing ? <X /> : <Play />}
                  {previewing ? 'ปิดตัวอย่าง' : 'ดูตัวอย่าง'}
                </Button>
                <Button size="sm" asChild>
                  <Link to={`/clips/${clip.projectId}${clipSearch}`}>
                    <Pencil />
                    เปิดคลิป
                  </Link>
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" disabled={discarding} onClick={onDiscard}>
              <Trash2 />
              ทิ้ง
            </Button>
          </div>
        </div>
      </div>
      {previewing && clip.projectId ? (
        <div className="pt-3">
          <ClipPreview projectId={clip.projectId} />
        </div>
      ) : null}
    </li>
  );
}

/** "สร้างคลิปอัตโนมัติ" on a ready, transcribed source + the review list (E07-F08). */
export function AutoClipsPanel({
  source,
  clipSearch = `?source=${source.id}`,
}: {
  source: SourceSummary;
  clipSearch?: string;
}) {
  const transcript = useTranscriptState(source.id, source.status === 'ready');
  const ready = transcript.data?.status === 'ready';
  const clips = useClips(source.id, ready);
  const generate = useGenerateClips(source.id);
  const build = useBuildClips(source.id);
  const discard = useDiscardClip(source.id);
  const [product, setProduct] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const state = clips.data;
  const view = clipsPanelView(ready, clips.status, state !== undefined);
  const active = clipsActive(state) || generate.isPending || build.isPending;
  const phase = state?.phase ?? 'none';
  const styleName = state?.advice?.items.find((a) => a.styleId === state.styleId)?.name;
  const list = state?.clips ?? [];
  const built = list.filter((c) => c.status === 'ready').length;
  const failure = generate.error ?? build.error;
  const err =
    failure instanceof ApiError
      ? ((failure.body as { message?: string } | null)?.message ?? 'เริ่มไม่สำเร็จ')
      : failure
        ? 'เริ่มไม่สำเร็จ'
        : null;

  const start = (fresh: boolean) =>
    generate.mutate({ productName: product.trim() || undefined, fresh: fresh || undefined });

  return (
    <section
      className="space-y-4 rounded-xl border bg-card p-4"
      aria-labelledby="auto-clips-h"
      data-testid="auto-clips"
      data-run-status={state?.status ?? 'none'}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="auto-clips-h" className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          คลิปอัตโนมัติ
        </h2>
        {state?.mode ? (
          <span className="text-xs text-muted-foreground">
            วิเคราะห์แบบ {state.mode === 'rules' ? 'กฎ (ไม่ใช้ AI)' : 'AI'}
          </span>
        ) : null}
      </div>

      {view === 'transcript' ? (
        <p className="text-sm text-muted-foreground">ถอดเสียงวิดีโอนี้ก่อน แล้วระบบจะหาช่วงขายของที่น่าตัดเป็นคลิปให้</p>
      ) : view === 'loading' ? (
        <p role="status" className="text-sm text-muted-foreground">
          กำลังโหลด…
        </p>
      ) : view === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          โหลดคลิปไม่สำเร็จ ลองโหลดหน้านี้อีกครั้ง
        </p>
      ) : (
        <>
          {!state || state.status === 'none' || state.status === 'failed' || state.status === 'cancelled' ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <label htmlFor="clip-product" className="text-muted-foreground">
                  ชื่อสินค้า (ไม่ใส่ก็ได้ ใช้ในชื่อคลิป)
                </label>
                <Input
                  id="clip-product"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="เช่น เสื้อมัดย้อมวินเทจ"
                  maxLength={80}
                />
              </div>
              <Button
                data-testid="clips-generate"
                disabled={active}
                onClick={() => start(state?.status === 'failed')}
              >
                <Sparkles />
                สร้างคลิปอัตโนมัติ
              </Button>
            </div>
          ) : null}
          {err ? (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          ) : null}
          {state?.status === 'failed' ? (
            <p role="alert" className="text-sm text-destructive">
              สร้างคลิปไม่สำเร็จ ลองกดสร้างอีกครั้ง หรือดูรายละเอียดที่หน้า "งานประมวลผล"
            </p>
          ) : null}
          {active ? (
            <p role="status" className="text-sm text-muted-foreground" data-testid="clips-progress">
              {phase === 'analysing' || list.length === 0
                ? 'กำลังวิเคราะห์วิดีโอ หาช่วงที่น่าตัด และดูว่าสไตล์ไหนเหมาะ…'
                : `ตัดต่อแล้ว ${built} จาก ${list.length}${styleName ? ` (สไตล์ ${styleName})` : ''} — คลิปที่เสร็จจะขึ้นทีละอัน`}
            </p>
          ) : null}
          {state?.status === 'succeeded' && list.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="clips-empty">
              ไม่พบช่วงที่เหมาะทำคลิปในวิดีโอนี้ (ต้องมีช่วงพูดขายของอย่างน้อย 15 วินาที)
            </p>
          ) : null}
          {phase === 'choose_style' && state?.advice ? (
            <StyleChooser
              advice={state.advice}
              clipCount={list.length}
              starting={build.isPending}
              onStart={(styleId) => build.mutate(styleId)}
            />
          ) : null}
          {styleName && phase !== 'choose_style' ? (
            <p className="text-xs text-muted-foreground" data-testid="clips-style">
              สไตล์การตัดต่อ: {styleName}
            </p>
          ) : null}
          {list.length > 0 ? (
            <ul className="space-y-3" aria-label="คลิปที่ระบบเสนอ">
              {list.map((c) => (
                <ClipCard
                  key={c.id}
                  source={source}
                  clip={c}
                  previewing={preview === c.id}
                  onPreview={(on) => setPreview(on ? c.id : null)}
                  onDiscard={() => discard.mutate(c.id)}
                  discarding={discard.isPending}
                  waitingForStyle={phase === 'choose_style'}
                  clipSearch={clipSearch}
                />
              ))}
            </ul>
          ) : null}
          {state?.status === 'succeeded' ? (
            <Button
              variant="outline"
              size="sm"
              data-testid="clips-regenerate"
              disabled={active}
              onClick={() => start(true)}
            >
              <RotateCcw />
              สร้างใหม่
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
