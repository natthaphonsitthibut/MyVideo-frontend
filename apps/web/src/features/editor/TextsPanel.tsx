import { formatTimecode, setText } from '@myvideo/timeline-core';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { useClips } from '@/api/clips';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { EditorStore } from './editor-store';
import {
  addTextElement,
  aiTextOptions,
  ENTRANCES,
  openingTextId,
  removeElement,
  setEntrance,
} from './text-elements';
import { useElement } from './use-editor';

type TextEl = {
  id: string;
  type: 'text';
  content: string;
  startFrame: number;
  durationFrames: number;
  animationIn?: { presetId: string };
};

/** The on-screen texts of the clip (opening title, price tags, product name, closing card), editable in place. */
export function TextsPanel({
  store,
  playhead,
  sourceId,
  projectId,
}: {
  store: EditorStore;
  playhead: () => number;
  sourceId?: string;
  projectId: string;
}) {
  const clips = useClips(sourceId ?? '', Boolean(sourceId));
  const options = aiTextOptions(clips.data?.clips.find((c) => c.projectId === projectId));
  const pickHook = (text: string) => {
    const opening = openingTextId(store.doc() as never);
    if (opening) store.run(setText(opening, text));
    else store.run(addTextElement({ id: crypto.randomUUID(), trackId: crypto.randomUUID(), at: 0, text }));
  };
  // the list of text ids changes only when elements are added/removed (rare): read it as a joined string
  const ids = useSyncExternalStore(store.subscribe, () =>
    Object.values(store.doc().elements)
      .filter((e) => e.type === 'text')
      .sort((a, b) => a.startFrame - b.startFrame)
      .map((e) => e.id)
      .join(','),
  );
  const list = ids ? ids.split(',') : [];
  const add = () =>
    store.run(
      addTextElement({
        id: crypto.randomUUID(),
        trackId: crypto.randomUUID(),
        at: playhead(),
        text: 'ข้อความใหม่',
      }),
    );
  return (
    <div className="space-y-3">
      {options.length > 0 ? (
        <div className="space-y-2 rounded-lg border bg-card p-3" data-testid="ai-text-options">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="size-4 text-amber-300" aria-hidden />
            ข้อความที่ AI เสนอ — กดเพื่อใช้เป็นหัวคลิป
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o.text}
                type="button"
                className="min-h-11 rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => pickHook(o.text)}
                data-testid="ai-text-option"
              >
                <span className="block text-xs text-muted-foreground">{o.kind}</span>
                {o.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Button variant="secondary" onClick={add} data-testid="add-text">
        <Plus />
        เพิ่มข้อความตรงตำแหน่งที่เล่นอยู่
      </Button>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">คลิปนี้ยังไม่มีข้อความบนจอ</p>
      ) : (
        <ul className="space-y-3" data-testid="texts-panel">
          {list.map((id) => (
            <TextRow key={id} store={store} id={id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TextRow({ store, id }: { store: EditorStore; id: string }) {
  const el = useElement<TextEl>(store, id);
  const [draft, setDraft] = useState<string | null>(null);
  if (!el) return null;
  const fps = store.doc().fps;
  const value = draft ?? el.content;
  const commit = () => {
    if (draft !== null && draft !== el.content && draft.trim()) store.run(setText(id, draft));
    setDraft(null);
  };
  return (
    <li className="space-y-1 rounded-lg border bg-card p-3">
      <Label htmlFor={`text-${id}`} className="text-xs text-muted-foreground tabular-nums">
        {formatTimecode(el.startFrame, fps)} – {formatTimecode(el.startFrame + el.durationFrames, fps)}
      </Label>
      <textarea
        id={`text-${id}`}
        data-testid="text-input"
        className="block w-full resize-y rounded-md border bg-background px-3 py-2 text-base leading-relaxed"
        rows={Math.min(4, value.split('\n').length + 1)}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          ตอนขึ้น
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={el.animationIn?.presetId ?? 'fade'}
            onChange={(e) => store.run(setEntrance(id, e.target.value))}
            data-testid="text-entrance"
          >
            {ENTRANCES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-destructive"
          onClick={() => store.run(removeElement(id))}
          data-testid="text-remove"
        >
          <Trash2 />
          ลบ
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Enter = บันทึก · Shift+Enter = ขึ้นบรรทัดใหม่</p>
    </li>
  );
}
