import { canvasMeasure, captionFont, captionMaxWidth, loadCaptionFont } from '@myvideo/stage';
import { useState, useSyncExternalStore } from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CAPTION_LOOKS, CAPTION_POSITIONS, restyleCaptions } from './caption-style';
import type { EditorStore } from './editor-store';

type Caption = { type: 'caption'; styleRef: string; transform: { y: number } };

/** Caption look and height for the whole clip (one command, undoable); the preview updates in place. */
export function StylePanel({ store, canvasWidth }: { store: EditorStore; canvasWidth: number }) {
  const current = useSyncExternalStore(store.subscribe, () => {
    const c = Object.values(store.doc().elements).find((e) => e.type === 'caption') as unknown as
      | Caption
      | undefined;
    return c ? `${c.styleRef}|${c.transform.y}` : '';
  });
  const [busy, setBusy] = useState(false);
  if (!current) return <p className="text-sm text-muted-foreground">คลิปนี้ไม่มีคำบรรยาย</p>;
  const [styleRef = 'clean', yRaw = '0'] = current.split('|');
  const y = Number(yRaw);
  const position =
    (Object.entries(CAPTION_POSITIONS).find(([, v]) => v === y)?.[0] as keyof typeof CAPTION_POSITIONS) ??
    'custom';

  const apply = async (next: { styleRef: string; y: number }) => {
    setBusy(true);
    try {
      await loadCaptionFont(captionFont(next.styleRef));
      store.run(
        restyleCaptions(next, (s) => ({
          measure: canvasMeasure(captionFont(s)),
          maxWidth: captionMaxWidth(canvasWidth, s),
        })),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="style-panel">
      <div className="space-y-2">
        <p className="text-sm font-medium">หน้าตาคำบรรยาย</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CAPTION_LOOKS.map((look) => (
            <button
              key={look.id}
              type="button"
              disabled={busy}
              data-testid={`look-${look.id}`}
              data-selected={look.id === styleRef}
              onClick={() => void apply({ styleRef: look.id, y })}
              className="min-h-11 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
            >
              {look.name}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">ตำแหน่ง</p>
        <SegmentedControl
          label="ตำแหน่งคำบรรยาย"
          options={[
            { value: 'top', label: 'บน' },
            { value: 'middle', label: 'กลาง' },
            { value: 'bottom', label: 'ล่าง' },
          ]}
          value={position}
          state={busy ? 'loading' : 'ready'}
          onValueChange={(v) =>
            void apply({ styleRef, y: CAPTION_POSITIONS[v as keyof typeof CAPTION_POSITIONS] })
          }
        />
        <p className="text-xs text-muted-foreground">คำบรรยายจะไม่ทับปุ่มของแอปด้านขวาและด้านล่างเสมอ</p>
      </div>
    </div>
  );
}
