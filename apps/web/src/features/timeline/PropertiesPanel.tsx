import type { Player } from '@myvideo/stage';
import {
  ANIMATION_PRESETS,
  type Command,
  duckUnderSpeech,
  type Easing,
  KEYFRAME_PROPS,
  removeKeyframe,
  setAnimation,
  setKeyframe,
  setOpacity,
  setSpeed,
  setText,
  setTransform,
  setVolume,
  speechSpans,
  type TimelineElement,
} from '@myvideo/timeline-core';
import { Diamond, Trash2, Volume1 } from 'lucide-react';
import { type RefObject, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EditorStore } from '@/features/editor/editor-store';
import { useElement } from '@/features/editor/use-editor';
import { refusal } from './Timeline';

const PROP_NAME: Record<string, string> = {
  'transform.x': 'ตำแหน่ง X',
  'transform.y': 'ตำแหน่ง Y',
  'transform.scale': 'ขนาด',
  'transform.rotation': 'หมุน',
  opacity: 'ความทึบ',
};
const PRESET_NAME: Record<string, string> = {
  fade: 'ค่อย ๆ ขึ้น',
  pop: 'เด้ง',
  bounce: 'กระดอน',
  'slide-up': 'เลื่อนขึ้น',
  'zoom-in': 'ซูมเข้า',
};
const EASINGS: { id: Easing; name: string }[] = [
  { id: 'ease-in-out', name: 'นุ่มทั้งต้นและปลาย' },
  { id: 'ease-out', name: 'ช้าลงตอนจบ' },
  { id: 'ease-in', name: 'เร่งขึ้น' },
  { id: 'linear', name: 'เท่ากันตลอด' },
  { id: 'hold', name: 'กระโดด (ไม่ไล่)' },
];

/** Numeric field that commits on Enter/blur (one command), never per keystroke. */
function NumberField(p: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
  testId?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    setDraft(null);
    if (Number.isFinite(v) && v !== p.value) p.onCommit(v);
  };
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{p.label}</span>
      <input
        type="number"
        className="h-8 w-24 rounded-md border bg-background px-2 text-right tabular-nums"
        step={p.step}
        min={p.min}
        max={p.max}
        value={draft ?? String(Math.round(p.value * 1000) / 1000)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
        data-testid={p.testId}
      />
    </label>
  );
}

/** Values of the selected element (E09-F08/F09); keyframes are added at the playhead. */
export function PropertiesPanel({
  store,
  id,
  playerRef,
  onMessage,
}: {
  store: EditorStore;
  id: string;
  playerRef: RefObject<Player | null>;
  onMessage: (m: string | null) => void;
}) {
  const el = useElement<TimelineElement>(store, id);
  const [easing, setEasing] = useState<Easing>('ease-in-out');
  if (!el) return null;
  const run = (cmd: Command) => {
    try {
      store.run(cmd);
      onMessage(null);
    } catch (err) {
      onMessage(refusal(err));
    }
  };
  const local = Math.max(0, Math.min(el.durationFrames - 1, (playerRef.current?.frame ?? 0) - el.startFrame));
  const visual = el.type !== 'audio';
  const media = el.type === 'video' || el.type === 'audio' ? el : null;
  const transform = 'transform' in el ? el.transform : null;
  /** A keyframed property is changed at the playhead (that keyframe), a plain one as its fixed value. */
  const commitProp = (prop: string, value: number, plain: () => Command) =>
    run(el.keyframes?.[prop]?.length ? setKeyframe(id, prop, local, value, easing) : plain());
  const current = (prop: string): number => {
    if (prop === 'opacity') return el.opacity ?? 1;
    const key = prop.split('.')[1] as keyof NonNullable<typeof transform>;
    return transform ? Number(transform[key]) : 0;
  };
  return (
    <div className="space-y-4 text-sm" data-testid="properties-panel">
      {el.type === 'text' ? (
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">ข้อความ</span>
          <textarea
            key={el.content}
            className="block w-full rounded-md border bg-background px-2 py-1 text-sm"
            rows={2}
            defaultValue={el.content}
            onBlur={(e) =>
              e.target.value !== el.content && e.target.value.trim() && run(setText(id, e.target.value))
            }
          />
        </label>
      ) : null}
      {transform ? (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium">ตำแหน่งและขนาด</legend>
          <NumberField
            label="X (px)"
            value={transform.x}
            step={10}
            onCommit={(x) => commitProp('transform.x', x, () => setTransform(id, { ...transform, x }))}
            testId="prop-x"
          />
          <NumberField
            label="Y (px)"
            value={transform.y}
            step={10}
            onCommit={(y) => commitProp('transform.y', y, () => setTransform(id, { ...transform, y }))}
          />
          <NumberField
            label="ขนาด (เท่า)"
            value={transform.scale}
            step={0.05}
            min={0.05}
            max={10}
            onCommit={(scale) =>
              commitProp('transform.scale', scale, () => setTransform(id, { ...transform, scale }))
            }
            testId="prop-scale"
          />
          <NumberField
            label="หมุน (องศา)"
            value={transform.rotation}
            step={1}
            onCommit={(rotation) =>
              commitProp('transform.rotation', rotation, () => setTransform(id, { ...transform, rotation }))
            }
          />
        </fieldset>
      ) : null}
      {visual ? (
        <NumberField
          label="ความทึบ (0–1)"
          value={el.opacity ?? 1}
          step={0.05}
          min={0}
          max={1}
          onCommit={(v) => commitProp('opacity', v, () => setOpacity(id, v))}
          testId="prop-opacity"
        />
      ) : null}
      {media ? (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium">เสียงและความเร็ว</legend>
          <NumberField
            label="ความดัง (0–2)"
            value={media.volume}
            step={0.05}
            min={0}
            max={2}
            onCommit={(v) => run(setVolume(id, v))}
            testId="prop-volume"
          />
          <NumberField
            label="ความเร็ว (0.25–4×)"
            value={media.playbackRate}
            step={0.25}
            min={0.25}
            max={4}
            onCommit={(v) => run(setSpeed(id, v))}
            testId="prop-speed"
          />
          {el.type === 'audio' ? (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => run(duckUnderSpeech(id, speechSpans(store.doc()), () => crypto.randomUUID()))}
              data-testid="duck-music"
            >
              <Volume1 />
              ลดเสียงเพลงตอนคนพูด (−10 dB)
            </Button>
          ) : null}
        </fieldset>
      ) : null}
      {visual ? (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium">ท่าเข้า / ท่าออก</legend>
          {(['in', 'out'] as const).map((which) => {
            const cur = which === 'in' ? el.animationIn : el.animationOut;
            return (
              <label key={which} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{which === 'in' ? 'ตอนขึ้น' : 'ตอนหาย'}</span>
                <select
                  className="h-8 rounded-md border bg-background px-2"
                  value={cur?.presetId ?? ''}
                  onChange={(e) => run(setAnimation(id, which, e.target.value || null))}
                  data-testid={`anim-${which}`}
                >
                  <option value="">ไม่มี</option>
                  {ANIMATION_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {PRESET_NAME[p] ?? p}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {visual ? (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium">คีย์เฟรม (ที่ตำแหน่งหัวเล่น)</legend>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">การไล่ค่า</span>
            <select
              className="h-8 rounded-md border bg-background px-2"
              value={easing}
              onChange={(e) => setEasing(e.target.value as Easing)}
            >
              {EASINGS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {KEYFRAME_PROPS.map((prop) => {
            const kfs = el.keyframes?.[prop] ?? [];
            return (
              <div key={prop} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>{PROP_NAME[prop]}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(setKeyframe(id, prop, local, current(prop), easing))}
                    data-testid={`kf-add-${prop}`}
                  >
                    <Diamond className="size-3.5" />
                    ใส่คีย์เฟรม
                  </Button>
                </div>
                {kfs.length ? (
                  <ul className="space-y-0.5 pl-2 text-xs text-muted-foreground">
                    {kfs.map((k) => (
                      <li key={k.frame} className="flex items-center justify-between">
                        <button
                          type="button"
                          className="tabular-nums hover:underline"
                          onClick={() => void playerRef.current?.seek(el.startFrame + k.frame)}
                        >
                          เฟรม {k.frame} = {Math.round(k.value * 100) / 100}
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="ลบคีย์เฟรม"
                          onClick={() => run(removeKeyframe(id, prop, k.frame))}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            ใส่คีย์เฟรมอย่างน้อย 2 จุด แล้วเปลี่ยนค่าระหว่างนั้น (เช่น ขนาด 1 → 1.3) เพื่อให้ภาพเคลื่อนไหว
          </p>
        </fieldset>
      ) : null}
    </div>
  );
}
