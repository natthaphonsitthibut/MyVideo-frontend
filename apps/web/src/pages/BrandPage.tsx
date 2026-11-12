import { Upload } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import {
  type BrandKit,
  type BrandKitBody,
  brandLogoUrl,
  useBrandKit,
  useSaveBrandKit,
  useUploadLogo,
} from '@/api/brand';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const FONTS: { id: BrandKitBody['font']; name: string }[] = [
  { id: 'noto-sans-thai', name: 'Noto Sans Thai' },
];
const COLORS: { key: 'primaryColor' | 'accentColor' | 'textColor'; name: string; hint: string }[] = [
  { key: 'primaryColor', name: 'สีหลัก', hint: 'กล่องหลังข้อความหัวคลิป' },
  { key: 'accentColor', name: 'สีเน้น', hint: 'ป้ายราคาและปุ่มชวนซื้อ' },
  { key: 'textColor', name: 'สีตัวอักษร', hint: 'ตัวหนังสือบนกล่องสีหลัก' },
];

/** The shop's brand kit (E08-F08): colours, font, default call-to-action and logo used by every clip. */
export function BrandPage() {
  const kit = useBrandKit();
  if (kit.isError) throw kit.error;
  return (
    <section className="page-layout max-w-2xl">
      <h1 className="text-2xl font-semibold">แบรนด์ของร้าน</h1>
      <p className="text-sm text-muted-foreground">
        คลิปที่กด “ใช้สีแบรนด์” ไว้ จะเปลี่ยนตามค่าที่นี่เองทุกคลิป ไม่ต้องแก้ทีละคลิป
      </p>
      {kit.isPending ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="กำลังโหลด">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <LogoCard kit={kit.data} />
          <BrandForm key={kit.data.updatedAt ?? 'new'} kit={kit.data} />
        </>
      )}
    </section>
  );
}

function LogoCard({ kit }: { kit: BrandKit }) {
  const upload = useUploadLogo();
  const input = useRef<HTMLInputElement>(null);
  const err = upload.error instanceof ApiError ? upload.error.status : upload.error ? 0 : null;
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
      <div className="grid size-20 place-items-center rounded-lg border bg-muted">
        {kit.hasLogo ? (
          <img src={brandLogoUrl(kit)} alt="โลโก้ร้าน" className="size-full rounded-lg object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">ไม่มีโลโก้</span>
        )}
      </div>
      <div className="space-y-1">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          data-testid="logo-input"
          aria-label="เลือกไฟล์โลโก้"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={upload.isPending}>
          <Upload />
          {upload.isPending ? 'กำลังอัปโหลด…' : kit.hasLogo ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPG หรือ WebP ไม่เกิน 2 MB (พื้นหลังใสดูดีที่สุด)</p>
        {err !== null ? (
          <p className="text-xs text-destructive" role="alert">
            {err === 413
              ? 'ไฟล์ใหญ่เกิน 2 MB'
              : err === 415
                ? 'ใช้ได้เฉพาะ PNG, JPG หรือ WebP'
                : 'อัปโหลดไม่สำเร็จ ลองอีกครั้ง'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BrandForm({ kit }: { kit: BrandKit }) {
  const save = useSaveBrandKit();
  const [form, setForm] = useState<BrandKitBody>({
    primaryColor: kit.primaryColor,
    accentColor: kit.accentColor,
    textColor: kit.textColor,
    font: kit.font,
    defaultCta: kit.defaultCta,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };
  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-4" data-testid="brand-form">
      <div className="grid gap-4 sm:grid-cols-3">
        {COLORS.map((c) => (
          <div key={c.key} className="space-y-1">
            <Label htmlFor={c.key}>{c.name}</Label>
            <div className="flex items-center gap-2">
              <input
                id={c.key}
                type="color"
                value={form[c.key]}
                onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1"
                data-testid={`brand-${c.key}`}
              />
              <span className="font-mono text-xs text-muted-foreground">{form[c.key]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="brand-font">ฟอนต์</Label>
        <select
          id="brand-font"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.font}
          onChange={(e) => setForm({ ...form, font: e.target.value as BrandKitBody['font'] })}
        >
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="brand-cta">ข้อความชวนซื้อของร้าน</Label>
        <Input
          id="brand-cta"
          maxLength={40}
          value={form.defaultCta}
          onChange={(e) => setForm({ ...form, defaultCta: e.target.value })}
          data-testid="brand-cta-input"
        />
      </div>
      <div
        className="rounded-lg p-4 text-center"
        style={{ background: '#1f2937' }}
        role="img"
        aria-label="ตัวอย่าง"
        data-testid="brand-sample"
      >
        <span
          className="inline-block rounded px-3 py-1 text-lg font-extrabold"
          style={{ background: form.primaryColor, color: form.textColor }}
        >
          หัวคลิปตัวอย่าง
        </span>{' '}
        <span
          className="inline-block rounded px-3 py-1 text-lg font-extrabold"
          style={{ background: form.accentColor, color: form.primaryColor }}
        >
          {form.defaultCta || ' '}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending || !form.defaultCta.trim()} data-testid="brand-save">
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
        {save.isSuccess ? (
          <span className="text-sm text-muted-foreground" role="status">
            บันทึกแล้ว
          </span>
        ) : null}
        {save.isError ? (
          <span className="text-sm text-destructive" role="alert">
            บันทึกไม่สำเร็จ ลองอีกครั้ง
          </span>
        ) : null}
      </div>
    </form>
  );
}
