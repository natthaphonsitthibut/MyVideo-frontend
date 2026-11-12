import { canvasMeasure, captionFont, loadCaptionFont } from '@myvideo/stage';
import { Scissors, X } from 'lucide-react';
import { type RefObject, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { useCreateProject } from '@/api/projects';
import { formatDuration } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { buildClipDoc, CLIP_CAPTION_STYLE, type ClipSource, type ClipWord } from './clip-project';
import { sourceClipSearch } from './navigation';

export type WordRange = { from: number; to: number };

/**
 * The selected word range inside `root` (native text selection, so drag / shift+click / keyboard all work).
 * Words are the `[data-w]` spans the selection touches; updates only when the range changes (rare → React state).
 */
export function useWordSelection(root: RefObject<HTMLElement | null>): [WordRange | null, () => void] {
  const [range, setRange] = useState<WordRange | null>(null);
  useEffect(() => {
    const onChange = () => {
      const el = root.current;
      const sel = document.getSelection();
      let next: WordRange | null = null;
      if (
        el &&
        sel &&
        !sel.isCollapsed &&
        sel.rangeCount > 0 &&
        el.contains(sel.getRangeAt(0).commonAncestorContainer)
      ) {
        let from = Number.POSITIVE_INFINITY;
        let to = -1;
        for (const w of el.querySelectorAll<HTMLElement>('[data-w]')) {
          if (!sel.containsNode(w, true)) continue;
          const i = Number(w.dataset.w);
          if (i < from) from = i;
          if (i > to) to = i;
        }
        if (to >= 0) next = { from, to };
      }
      setRange((cur) => (cur?.from === next?.from && cur?.to === next?.to ? cur : next));
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, [root]);
  const clear = () => {
    document.getSelection()?.removeAllRanges();
    setRange(null);
  };
  return [range, clear];
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string } | null;
    return body?.message ? `สร้างคลิปไม่สำเร็จ: ${body.message}` : 'สร้างคลิปไม่สำเร็จ ลองใหม่อีกครั้ง';
  }
  return err instanceof Error ? err.message : 'สร้างคลิปไม่สำเร็จ ลองใหม่อีกครั้ง';
}

/** Shown while words are selected: the range, and "สร้างคลิป" → new project → clip page. */
export function CreateClipBar({
  range,
  words,
  source,
  onClear,
}: {
  range: WordRange;
  words: readonly ClipWord[];
  source: ClipSource | null;
  onClear: () => void;
}) {
  const create = useCreateProject();
  const navigate = useNavigate();
  const search = useLocation().search;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picked = words.slice(range.from, range.to + 1);
  const first = picked[0];
  const last = picked[picked.length - 1];
  if (!first || !last) return null;

  const onCreate = async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const font = captionFont(CLIP_CAPTION_STYLE);
      await loadCaptionFont(font);
      const doc = buildClipDoc({
        source,
        words: picked,
        measure: canvasMeasure(font),
        newId: () => crypto.randomUUID(),
      });
      const rec = await create.mutateAsync({ title: doc.meta.title ?? 'คลิปใหม่', doc });
      onClear();
      navigate(`/clips/${rec.id}${sourceClipSearch(search, source.id)}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1 border-t bg-primary/5 px-3 py-2" data-testid="clip-bar">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs tabular-nums" aria-live="polite">
          เลือก {picked.length} คำ · {formatDuration(first.startMs)}–{formatDuration(last.endMs)} (
          {((last.endMs - first.startMs) / 1000).toFixed(1)} วิ)
        </p>
        <Button size="icon" variant="ghost" className="size-8" aria-label="ยกเลิกการเลือก" onClick={onClear}>
          <X />
        </Button>
        <Button size="sm" onClick={onCreate} disabled={busy || !source} data-testid="clip-create">
          <Scissors />
          {busy ? 'กำลังสร้าง…' : 'สร้างคลิป'}
        </Button>
      </div>
      {!source ? <p className="text-xs text-muted-foreground">วิดีโอนี้ยังตรวจไฟล์ไม่เสร็จ จึงยังสร้างคลิปไม่ได้</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
