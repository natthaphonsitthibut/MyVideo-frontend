import { RotateCcw } from 'lucide-react';
import { useRef, useSyncExternalStore } from 'react';
import { useSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import type { EditorStore } from './editor-store';
import { reframe, reframeRange } from './reframe';

type Video = { type: 'video'; transform: { x: number } };

/**
 * Slide the picture sideways inside the 9:16 frame (E08-F06). The slider shows the value while dragging and commits
 * ONE command on release (no React render or stage rebuild per pointer move).
 */
export function ReframePanel({
  store,
  sourceId,
  frame,
}: {
  store: EditorStore;
  sourceId: string | undefined;
  frame: { width: number; height: number };
}) {
  const source = useSource(sourceId ?? '');
  const range = reframeRange(
    source.data
      ? { width: source.data.width ?? undefined, height: source.data.height ?? undefined }
      : undefined,
    frame.width,
    frame.height,
  );
  const x = useSyncExternalStore(store.subscribe, () => {
    const v = Object.values(store.doc().elements).find((e) => e.type === 'video') as unknown as
      | Video
      | undefined;
    return v?.transform.x ?? 0;
  });
  const labelRef = useRef<HTMLSpanElement>(null);
  if (!sourceId) return <p className="text-sm text-muted-foreground">คลิปนี้ไม่มีวิดีโอ</p>;
  if (range < 8)
    return (
      <p className="text-sm text-muted-foreground" data-testid="reframe-none">
        วิดีโอต้นฉบับเป็นแนวตั้งเต็มจออยู่แล้ว ไม่ต้องเลื่อนภาพ
      </p>
    );
  const pct = (v: number) => `${Math.round((v / range) * 100)}%`;
  return (
    <div className="space-y-4" data-testid="reframe-panel">
      <label className="block space-y-2 text-sm">
        <span className="flex justify-between">
          <span className="font-medium">เลื่อนภาพซ้าย–ขวา</span>
          <span ref={labelRef} className="tabular-nums text-muted-foreground">
            {pct(x)}
          </span>
        </span>
        <input
          type="range"
          className="w-full accent-primary"
          min={-range}
          max={range}
          step={1}
          defaultValue={x}
          key={x}
          data-testid="reframe-slider"
          onInput={(e) => {
            if (labelRef.current) labelRef.current.textContent = pct(Number(e.currentTarget.value));
          }}
          // React's onChange fires on every move for a range: commit only when the pointer/key is released
          onPointerUp={(e) => store.run(reframe(Number(e.currentTarget.value), range))}
          onKeyUp={(e) => store.run(reframe(Number(e.currentTarget.value), range))}
        />
      </label>
      <Button variant="outline" size="sm" onClick={() => store.run(reframe(0, range))} disabled={x === 0}>
        <RotateCcw />
        กลับกึ่งกลาง
      </Button>
    </div>
  );
}
