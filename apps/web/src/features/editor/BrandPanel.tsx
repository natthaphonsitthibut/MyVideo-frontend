import { ImageOff, ImagePlus, Megaphone, Palette, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useSyncExternalStore } from 'react';
import { brandLogoUrl, useBrandKit } from '@/api/brand';
import { Button } from '@/components/ui/button';
import { BrandKitEditor } from '@/features/brand/BrandKitEditor';
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
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button variant="link" size="sm" className="ml-auto" data-testid="brand-edit-kit">
              แก้แบรนด์ของร้าน
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 space-y-3 overflow-y-auto rounded-xl border bg-background p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold">แบรนด์ของร้าน</Dialog.Title>
                <Dialog.Close asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="ปิด">
                    <X />
                  </Button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">แก้สี ฟอนต์ ข้อความชวนซื้อ และโลโก้ของร้าน</Dialog.Description>
              <BrandKitEditor />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
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
      {!k.hasLogo ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีโลโก้ — กด “แก้แบรนด์ของร้าน” เพื่ออัปโหลด</p>
      ) : null}
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
