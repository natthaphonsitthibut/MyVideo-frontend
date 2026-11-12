import { ImageOff, ImagePlus, Megaphone, Palette } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { brandLogoUrl, useBrandKit } from '@/api/brand';
import { Button } from '@/components/ui/button';
import { addBrandCta, applyBrandToTexts, hasBrandLogo, toggleBrandLogo } from './brand-elements';
import type { EditorStore } from './editor-store';

/** Quick Edit "แบรนด์" tab: put the shop's colours, font, logo and own call-to-action on this clip. */
export function BrandPanel({ store }: { store: EditorStore }) {
  const kit = useBrandKit();
  const logoOn = useSyncExternalStore(store.subscribe, () => hasBrandLogo(store.doc() as never));
  if (kit.isPending) return <p className="text-sm text-muted-foreground">กำลังโหลดแบรนด์…</p>;
  if (kit.isError) return <p className="text-sm text-destructive">โหลดแบรนด์ไม่สำเร็จ ลองรีเฟรชหน้า</p>;
  const k = kit.data;
  return (
    <div className="space-y-4" data-testid="brand-panel">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        {k.hasLogo ? (
          <img src={brandLogoUrl(k)} alt="โลโก้ร้าน" className="size-12 rounded object-contain" />
        ) : null}
        <div className="flex gap-1" role="img" aria-label="สีแบรนด์">
          {[k.primaryColor, k.accentColor, k.textColor].map((c) => (
            <span key={c} className="size-6 rounded-full border" style={{ background: c }} title={c} />
          ))}
        </div>
        <Button variant="link" size="sm" asChild className="ml-auto">
          <Link to="/brand">แก้แบรนด์ของร้าน</Link>
        </Button>
      </div>
      <Button
        variant="secondary"
        className="w-full justify-start"
        onClick={() => store.run(applyBrandToTexts())}
        data-testid="brand-apply"
      >
        <Palette />
        ใช้สีและฟอนต์แบรนด์กับข้อความทั้งหมด
      </Button>
      <Button
        variant="secondary"
        className="w-full justify-start"
        disabled={!k.hasLogo && !logoOn}
        onClick={() => store.run(toggleBrandLogo({ id: crypto.randomUUID(), trackId: crypto.randomUUID() }))}
        data-testid="brand-logo"
      >
        {logoOn ? <ImageOff /> : <ImagePlus />}
        {logoOn ? 'เอาโลโก้ออก' : 'ใส่โลโก้มุมขวาบน'}
      </Button>
      {!k.hasLogo ? <p className="text-xs text-muted-foreground">ยังไม่มีโลโก้ — อัปโหลดได้ที่หน้าแบรนด์</p> : null}
      <Button
        variant="secondary"
        className="w-full justify-start"
        onClick={() =>
          store.run(
            addBrandCta({ id: crypto.randomUUID(), trackId: crypto.randomUUID(), label: k.defaultCta }),
          )
        }
        data-testid="brand-cta"
      >
        <Megaphone />
        เพิ่มปุ่มชวนซื้อของร้าน “{k.defaultCta}” ตอนท้ายคลิป
      </Button>
      <p className="text-xs text-muted-foreground">ข้อความที่ใช้สีแบรนด์จะเปลี่ยนตามเองเมื่อคุณแก้สีแบรนด์ในภายหลัง</p>
    </div>
  );
}
