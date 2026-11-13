import { useQueries } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { type FolderSettings, useUpdateFolder } from '@/api/folders';
import { sourceQuery } from '@/api/sources';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaveStatus } from '@/components/ui/save-status';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { MusicPicker } from '../editor/MusicPanel';
import { autoRatio } from './auto-ratio';

const RATIOS = [
  { value: 'auto', label: 'อัตโนมัติ' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
] as const;
const RATIO_HINT: Record<string, string> = {
  '9:16': 'แนวตั้ง · TikTok, Reels, Shorts',
  '16:9': 'แนวนอน · YouTube, Facebook',
  '1:1': 'จัตุรัส · ฟีด Facebook, Instagram',
  '4:5': 'แนวตั้งสั้น · ฟีด Instagram',
};
const GOALS = [
  { value: 'sell', label: 'ขายของ' },
  { value: 'review', label: 'รีวิวสินค้า' },
  { value: 'live', label: 'ไลฟ์ → หลายคลิป' },
] as const;
const LENGTHS = [
  { value: 'auto', label: 'อัตโนมัติ' },
  { value: '15', label: '15 วิ' },
  { value: '30', label: '30 วิ' },
  { value: '60', label: '60 วิ' },
] as const;

/** Width/height of every footage item (probed), for the "auto" ratio. */
function useFootageSizes(sourceIds: string[]) {
  return useQueries({
    queries: sourceIds.map((id) => sourceQuery(id)),
    combine: (results) =>
      results.flatMap((r) => (r.data ? [{ width: r.data.width, height: r.data.height }] : [])),
  });
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FolderSettingsPanel({
  folderId,
  settings,
  sourceIds,
}: {
  folderId: string;
  settings: FolderSettings;
  sourceIds: string[];
}) {
  const ids = useId();
  const update = useUpdateFolder(folderId);
  const sizes = useFootageSizes(sourceIds);
  const [name, setName] = useState(settings.productName ?? '');
  const [price, setPrice] = useState(settings.productPrice ?? '');
  // the server copy wins when it changes underneath (another tab, a retry)
  useEffect(() => setName(settings.productName ?? ''), [settings.productName]);
  useEffect(() => setPrice(settings.productPrice ?? ''), [settings.productPrice]);

  // what the merchant just chose shows at once; the server copy takes over when the save lands (or fails)
  const shown = (update.isPending && update.variables?.settings) || settings;
  const save = (patch: Partial<FolderSettings>) => update.mutate({ settings: { ...shown, ...patch } });
  const saveText = () => {
    const productName = name.trim() || null;
    const productPrice = price.trim() || null;
    if (productName !== shown.productName || productPrice !== shown.productPrice)
      save({ productName, productPrice });
  };
  const resolved = shown.ratio === 'auto' ? autoRatio(sizes) : shown.ratio;
  const state = update.isPending ? 'saving' : update.isError ? 'error' : 'saved';

  return (
    <section aria-labelledby="settings-heading" className="space-y-6 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="settings-heading" className="text-lg font-semibold">
          ตั้งค่าการตัดต่อ
        </h2>
        {update.isIdle ? null : (
          <SaveStatus
            state={state}
            onRetry={() => (update.variables ? update.mutate(update.variables) : undefined)}
          />
        )}
      </div>
      <Field
        label="สัดส่วนภาพ"
        hint={
          shown.ratio === 'auto'
            ? `${sizes.length ? `ตามฟุตเทจส่วนใหญ่ → ${resolved}` : 'ยังไม่มีฟุตเทจ → 9:16'} · ${RATIO_HINT[resolved]}`
            : RATIO_HINT[resolved]
        }
      >
        <SegmentedControl
          label="สัดส่วนภาพ"
          options={RATIOS}
          value={shown.ratio}
          onValueChange={(v) => save({ ratio: v as FolderSettings['ratio'] })}
        />
      </Field>
      <Field label="ทำวิดีโอแบบไหน">
        <SegmentedControl
          label="ทำวิดีโอแบบไหน"
          options={GOALS}
          value={shown.goal}
          onValueChange={(v) => save({ goal: v as FolderSettings['goal'] })}
        />
      </Field>
      <Field label="ความยาว" hint={shown.goal === 'live' ? 'ความยาวของแต่ละคลิป' : undefined}>
        <SegmentedControl
          label="ความยาว"
          options={LENGTHS}
          value={shown.length}
          onValueChange={(v) => save({ length: v as FolderSettings['length'] })}
        />
      </Field>
      <div className="space-y-4 border-t pt-5">
        <MusicPicker value={shown.musicId ?? null} onChange={(musicId) => save({ musicId })} />
        <div>
          <p className="text-sm font-medium">ข้อมูลสินค้า (ไม่ใส่ก็ได้)</p>
          <p className="mt-1 text-xs text-muted-foreground">ใช้ตามที่คุณพิมพ์เท่านั้น ระบบไม่เดาชื่อหรือราคาให้</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-name`}>ชื่อสินค้า</Label>
          <Input
            id={`${ids}-name`}
            value={name}
            maxLength={120}
            placeholder="เช่น เสื้อมัดย้อม ลายหมาป่า"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveText}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-price`}>ราคา</Label>
          <Input
            id={`${ids}-price`}
            value={price}
            maxLength={40}
            placeholder="เช่น 199 บาท"
            onChange={(e) => setPrice(e.target.value)}
            onBlur={saveText}
          />
        </div>
      </div>
    </section>
  );
}
