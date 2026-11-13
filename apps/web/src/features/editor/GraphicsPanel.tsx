import {
  ENERGY_IDS,
  type Energy,
  GRAPHIC_IDS,
  GRAPHIC_LABELS,
  type GraphicKind,
  graphicLayers,
  type StageProject,
} from '@myvideo/stage';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EditorStore } from './editor-store';

export function GraphicsPanel({ store, playhead }: { store: EditorStore; playhead: () => number }) {
  const [component, setComponent] = useState<GraphicKind>('lower-third'),
    [energy, setEnergy] = useState<Energy>('normal');
  const [text, setText] = useState(''),
    [assetId, setAssetId] = useState(''),
    [afterAssetId, setAfterAssetId] = useState('');
  const [x, setX] = useState(''),
    [y, setY] = useState(''),
    [chat, setChat] = useState(''),
    [error, setError] = useState('');
  const images = Object.entries((store.doc() as unknown as StageProject).assets).filter(
    ([, a]) => a.kind === 'image',
  );
  const media = component === 'before-after' || component === 'logo-sting';
  const add = () => {
    try {
      let evidence: { kind: 'merchant' | 'chat'; quote: string; sourceFrame?: number } = {
        kind: 'merchant',
        quote: text || 'merchant image',
      };
      if (component === 'live-comment') {
        const log = JSON.parse(chat) as { text: string; sourceFrame: number }[];
        const row = Array.isArray(log)
          ? log.find((row) => row.text === text && Number.isInteger(row.sourceFrame) && row.sourceFrame >= 0)
          : undefined;
        if (!row) throw new Error('ต้องมีข้อความและ sourceFrame ที่ตรงกันในบันทึกแชท JSON');
        evidence = { kind: 'chat', quote: row.text, sourceFrame: row.sourceFrame };
      }
      if (component === 'feature-callout' && (!x.trim() || !y.trim())) throw new Error('ระบุจุดบนสินค้าให้ครบ');
      const layers = graphicLayers(
        store.doc() as unknown as StageProject,
        {
          component,
          energy,
          text,
          evidence,
          assetId,
          afterAssetId,
          ...(component === 'feature-callout' ? { point: { x: Number(x), y: Number(y) } } : {}),
        },
        playhead(),
        () => crypto.randomUUID(),
      );
      store.run({
        label: 'add graphic',
        apply(d) {
          for (const t of layers.tracks) d.tracks.push(t);
          for (const e of layers.elements) d.elements[e.id] = e;
        },
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มกราฟิกไม่ได้');
    }
  };
  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="กราฟิกและการเคลื่อนไหว">
      <p className="text-sm font-medium">กราฟิกและการเคลื่อนไหว</p>
      <label className="block text-sm">
        รูปแบบ
        <select
          className="mt-1 w-full rounded-md border bg-background p-2"
          value={component}
          onChange={(e) => setComponent(e.target.value as GraphicKind)}
        >
          {GRAPHIC_IDS.map((id) => (
            <option key={id} value={id}>
              {GRAPHIC_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        ระดับการเคลื่อนไหว
        <select
          className="mt-1 w-full rounded-md border bg-background p-2"
          value={energy}
          onChange={(e) => setEnergy(e.target.value as Energy)}
        >
          {ENERGY_IDS.map((id, i) => (
            <option key={id} value={id}>
              {['นิ่งสงบ', 'เบา', 'ปกติ', 'คึกคัก', 'จัดเต็ม'][i]}
            </option>
          ))}
        </select>
      </label>
      {!media ? (
        <label className="block text-sm">
          {component === 'review-card'
            ? 'ข้อความจากรีวิวจริง'
            : component === 'step-list'
              ? 'ขั้นตอนจริง (แยกบรรทัด)'
              : 'ข้อความจากข้อมูลจริง'}
          <textarea
            className="mt-1 w-full rounded-md border bg-background p-2"
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      ) : (
        <>
          <label className="block text-sm">
            {component === 'logo-sting' ? 'รูปโลโก้ของคุณ' : 'ภาพก่อน'}
            <select
              className="mt-1 w-full rounded-md border bg-background p-2"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              <option value="">เลือกรูปในโปรเจกต์</option>
              {images.map(([id], i) => (
                <option key={id} value={id}>
                  รูป {i + 1}
                </option>
              ))}
            </select>
          </label>
          {component === 'before-after' ? (
            <label className="block text-sm">
              ภาพหลัง
              <select
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={afterAssetId}
                onChange={(e) => setAfterAssetId(e.target.value)}
              >
                <option value="">เลือกรูปในโปรเจกต์</option>
                {images.map(([id], i) => (
                  <option key={id} value={id}>
                    รูป {i + 1}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      )}
      {component === 'feature-callout' ? (
        <div className="flex gap-2">
          {[
            ['แนวนอน', x, setX],
            ['แนวตั้ง', y, setY],
          ].map(([label, value, set]) => (
            <label key={String(label)} className="text-sm">
              {String(label)} (0–1)
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="w-full rounded-md border bg-background p-2"
                value={value as string}
                onChange={(e) => (set as (s: string) => void)(e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : null}
      {component === 'live-comment' ? (
        <label className="block text-sm">
          บันทึกแชท JSON (text, sourceFrame)
          <textarea
            className="w-full rounded-md border bg-background p-2"
            value={chat}
            onChange={(e) => setChat(e.target.value)}
          />
        </label>
      ) : null}
      <p className="text-xs text-muted-foreground">
        เพิ่มตรงตำแหน่งที่เล่นอยู่ เว้นเวลาให้ข้อความอ่านจบ ทุกเลเยอร์แก้ไขต่อในไทม์ไลน์ได้
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button variant="secondary" onClick={add}>
        เพิ่มกราฟิก
      </Button>
    </section>
  );
}
