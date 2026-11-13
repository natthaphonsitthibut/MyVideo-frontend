import { canvasMeasure, captionFont, captionMaxWidth, loadCaptionFont } from '@myvideo/stage';
import { type Command, formatTimecode, setCaptionWords } from '@myvideo/timeline-core';
import { Check, CornerDownLeft, Merge, Scissors, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  acceptCaptionWord,
  breakCaptionLineAt,
  captionRows,
  editCaptionWord,
  type Layout,
  mergeCaptionWithNext,
  removeCaptionWord,
  revertCaptionWord,
  splitCaptionAt,
} from './caption-edit';
import type { EditorStore } from './editor-store';
import { removeElement } from './text-elements';

type CaptionEl = Parameters<typeof editCaptionWord>[0] & { styleRef: string };

/** Measure with the caption's own font (the same code the stage and the server layout use). */
async function layoutFor(styleRef: string, canvasWidth: number): Promise<Layout> {
  const font = captionFont(styleRef);
  await loadCaptionFont(font);
  return { measure: canvasMeasure(font), maxWidth: captionMaxWidth(canvasWidth, styleRef), maxLines: 2 };
}

/**
 * Caption text, transcript-style (E08-F04): every caption page is a row; click a row to see it in the preview, click
 * a word to fix it. Words the AI corrected are marked (amber + ✦) with the heard word: keep, go back, or type.
 */
export function CaptionsPanel({
  store,
  canvasWidth,
  onSeek,
}: {
  store: EditorStore;
  canvasWidth: number;
  onSeek: (frame: number) => void;
}) {
  // caption rows change only on caption edits (rare): a serialised snapshot keeps React renders to those
  const snapshot = useSyncExternalStore(store.subscribe, () =>
    JSON.stringify(captionRows(store.doc().elements as never)),
  );
  const rows = JSON.parse(snapshot) as ReturnType<typeof captionRows>;
  const [editing, setEditing] = useState<{ id: string; index: number } | null>(null);
  const [draft, setDraft] = useState('');
  const fps = store.doc().fps;
  const aiLeft = rows.reduce((n, r) => n + r.words.filter((w) => w.ai).length, 0);

  const apply = async (
    id: string,
    change: (c: CaptionEl, layout: Layout) => { words: CaptionEl['words']; lines: number[][] },
  ) => {
    const c = store.doc().elements[id] as unknown as CaptionEl | undefined;
    if (!c) return;
    const next = change(c, await layoutFor(c.styleRef, canvasWidth));
    store.run(setCaptionWords(id, next.words, next.lines));
    setEditing(null);
  };

  /** Removes a word; the page's only word removes the whole caption page (the speech stays in the video). */
  const remove = (id: string, index: number, count: number) => {
    if (count <= 1) {
      store.run(removeElement(id));
      setEditing(null);
    } else void apply(id, (c, l) => removeCaptionWord(c, index, l));
  };
  /** Save the typed word; an empty box means "remove this word". */
  const save = (id: string, index: number, count: number) => {
    if (draft.trim()) void apply(id, (c, l) => editCaptionWord(c, index, draft, l));
    else remove(id, index, count);
  };

  const page = async (id: string, make: (layout: Layout) => Command) => {
    const c = store.doc().elements[id] as unknown as CaptionEl | undefined;
    if (!c) return;
    store.run(make(await layoutFor(c.styleRef, canvasWidth)));
    setEditing(null);
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">คลิปนี้ไม่มีคำบรรยาย</p>;
  return (
    <div className="space-y-2" data-testid="captions-panel">
      {aiLeft > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-amber-300" data-testid="caption-ai-count">
          <Sparkles className="size-4" aria-hidden />
          AI แก้คำให้ {aiLeft} คำ — กดที่คำสีเหลืองเพื่อตรวจ
        </p>
      ) : null}
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
        {rows.map((r, ri) => (
          <li key={r.id} className="flex gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
            <button
              type="button"
              className="w-12 shrink-0 text-left text-xs text-muted-foreground tabular-nums"
              onClick={() => onSeek(r.startFrame)}
            >
              {formatTimecode(r.startFrame, fps)}
            </button>
            <p className="min-w-0 flex-1 leading-8">
              {r.words.map((w, i) => {
                const open = editing?.id === r.id && editing.index === i;
                if (open) {
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: words are positional in a caption page
                    <span key={i} className="mx-0.5 inline-flex flex-wrap items-center gap-1 align-middle">
                      <Input
                        autoFocus
                        aria-label="แก้คำ"
                        data-testid="caption-word-input"
                        className="h-8 w-40"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') save(r.id, i, r.words.length);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                      <Button size="sm" onClick={() => save(r.id, i, r.words.length)}>
                        <Check />
                        {draft.trim() ? 'บันทึก' : 'บันทึก (ลบคำนี้)'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(r.id, i, r.words.length)}
                        data-testid="caption-word-delete"
                      >
                        <Trash2 />
                        ลบคำนี้
                      </Button>
                      {i > 0 ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void apply(r.id, (c, l) => breakCaptionLineAt(c, i, l))}
                            data-testid="caption-line-break"
                          >
                            <CornerDownLeft />
                            ขึ้นบรรทัดใหม่ตรงนี้
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void page(r.id, (l) => splitCaptionAt(r.id, i, crypto.randomUUID(), l))
                            }
                            data-testid="caption-split"
                          >
                            <Scissors />
                            แยกเป็นซับใหม่ตรงนี้
                          </Button>
                        </>
                      ) : null}
                      {w.ai ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void apply(r.id, (c) => acceptCaptionWord(c, i))}
                            data-testid="caption-word-accept"
                          >
                            ถูกแล้ว
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void apply(r.id, (c, l) => revertCaptionWord(c, i, l))}
                          >
                            <Undo2 />
                            คืน “{w.heard}”
                          </Button>
                        </>
                      ) : null}
                    </span>
                  );
                }
                return (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: words are positional in a caption page
                    key={i}
                    type="button"
                    data-testid="caption-word"
                    data-ai={w.ai ? '' : undefined}
                    title={w.ai ? `AI แก้จาก “${w.heard}”` : 'กดเพื่อแก้คำนี้'}
                    className="mr-1 rounded px-0.5 hover:bg-muted data-ai:bg-amber-500/25 data-ai:text-amber-100"
                    onClick={() => {
                      onSeek(r.startFrame);
                      setDraft(w.text);
                      setEditing({ id: r.id, index: i });
                    }}
                  >
                    {w.text}
                    {w.ai ? (
                      <Sparkles className="ml-0.5 inline size-3 align-super text-amber-300" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </p>
            <div className="flex shrink-0 items-start gap-0.5">
              {rows[ri + 1] ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="รวมกับบรรทัดถัดไป"
                  title="รวมกับบรรทัดถัดไป"
                  onClick={() =>
                    void page(r.id, (l) => mergeCaptionWithNext(r.id, rows[ri + 1]?.id ?? '', l))
                  }
                  data-testid="caption-merge"
                >
                  <Merge />
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-destructive"
                aria-label="ลบบรรทัดนี้"
                title="ลบบรรทัดนี้ (เสียงพูดยังอยู่)"
                onClick={() => store.run(removeElement(r.id))}
                data-testid="caption-delete"
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
