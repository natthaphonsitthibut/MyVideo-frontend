import { RotateCcw } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import type { EditorStore } from './editor-store';
import { currentZoom, MAX_ZOOM, reframe, reframeRange, shotScales, zoomShots } from './reframe';

type Video = { type: 'video'; transform: { x: number } };

/**
 * Zoom and slide the picture inside the 9:16 frame (E08-F06). Sliders show the value while dragging and commit
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
  // each shot's AI zoom when the editor opened: the merchant's zoom multiplies it
  const [base] = useState(() => shotScales(store.doc().elements));
  const zoom = useSyncExternalStore(store.subscribe, () => currentZoom(store.doc().elements, base));
  const asset = source.data
    ? { width: source.data.width ?? undefined, height: source.data.height ?? undefined }
    : undefined;
  const range = reframeRange(asset, frame.width, frame.height, zoom);
  const x = useSyncExternalStore(store.subscribe, () => {
    const v = Object.values(store.doc().elements).find((e) => e.type === 'video') as unknown as
      | Video
      | undefined;
    return v?.transform.x ?? 0;
  });
  const labelRef = useRef<HTMLSpanElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  if (!sourceId) return <p className="text-sm text-muted-foreground">คลิปนี้ไม่มีวิดีโอ</p>;
  const pct = (v: number) => `${range ? Math.round((v / range) * 100) : 0}%`;
  const commitZoom = (z: number) => {
    const f = z / 100;
    store.run(zoomShots(f, base));
    // keep the slide inside the new range (zooming out shrinks it)
    const r = reframeRange(asset, frame.width, frame.height, f);
    if (Math.abs(x) > r) store.run(reframe(x, r));
  };
  return (
    <div className="space-y-5" data-testid="reframe-panel">
      <label className="block space-y-2 text-sm">
        <span className="flex justify-between">
          <span className="font-medium">ซูม</span>
          <span ref={zoomLabelRef} className="tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </span>
        <input
          type="range"
          className="w-full accent-primary"
          min={100}
          max={MAX_ZOOM * 100}
          step={5}
          defaultValue={Math.round(zoom * 100)}
          key={`z${zoom}`}
          data-testid="zoom-slider"
          onInput={(e) => {
            if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${e.currentTarget.value}%`;
          }}
          onPointerUp={(e) => commitZoom(Number(e.currentTarget.value))}
          onKeyUp={(e) => commitZoom(Number(e.currentTarget.value))}
        />
      </label>
      {range < 8 ? (
        <p className="text-sm text-muted-foreground" data-testid="reframe-none">
          ภาพเต็มกรอบพอดี — ซูมเข้าก่อนถ้าต้องการเลื่อนภาพซ้าย–ขวา
        </p>
      ) : (
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
            key={`x${x}|${range}`}
            data-testid="reframe-slider"
            onInput={(e) => {
              if (labelRef.current) labelRef.current.textContent = pct(Number(e.currentTarget.value));
            }}
            // React's onChange fires on every move for a range: commit only when the pointer/key is released
            onPointerUp={(e) => store.run(reframe(Number(e.currentTarget.value), range))}
            onKeyUp={(e) => store.run(reframe(Number(e.currentTarget.value), range))}
          />
        </label>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          store.run(zoomShots(1, base));
          store.run(reframe(0, 0));
        }}
        disabled={x === 0 && Math.abs(zoom - 1) < 0.001}
        data-testid="reframe-reset"
      >
        <RotateCcw />
        คืนค่าเดิม
      </Button>
    </div>
  );
}
