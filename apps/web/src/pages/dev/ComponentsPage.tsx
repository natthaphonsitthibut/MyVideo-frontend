import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaveStatus } from '@/components/ui/save-status';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const colors = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'success',
  'warning',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'editor-surface',
] as const;
const options = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'ready', label: 'พร้อมแล้ว' },
  { value: 'export', label: 'ส่งออก', disabled: true },
];

function ComponentSurface({ editor = false }: { editor?: boolean }) {
  const id = useId();
  const [value, setValue] = useState('all');
  const [save, setSave] = useState<'saved' | 'saving' | 'error'>('error');
  return (
    <section
      data-theme={editor ? 'editor' : undefined}
      className="min-w-0 space-y-8 rounded-xl bg-background p-4 text-foreground sm:p-6"
      aria-label={editor ? 'พื้นตัดต่อสีเข้ม' : 'หน้าแอปสีสว่าง'}
    >
      <h2 className="text-2xl font-semibold">{editor ? 'พื้นตัดต่อสีเข้ม' : 'หน้าแอปสีสว่าง'}</h2>
      <section className="space-y-3" aria-label="สี">
        <h3 className="text-lg font-semibold">สีและหน้าที่</h3>
        <p className="text-sm text-muted-foreground">
          surface = background · surface-raised = card · text = foreground
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colors.map((color) => (
            <div key={color} className="min-w-0">
              <dt className="break-words text-xs">{color}</dt>
              <dd className="mt-1 h-8 rounded-md border" style={{ background: `var(--${color})` }} />
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-3" aria-label="ตัวอักษร">
        <h3 className="text-lg font-semibold">ตัวอักษรภาษาไทย</h3>
        {['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'].map((size) => (
          <p key={size} className={size}>
            ขายไว ไฟลุก <span className="text-xs text-muted-foreground">{size}</span>
          </p>
        ))}
        <p className="text-sm text-muted-foreground">เนื้อหา 1.6 · หัวข้อ 1.4 · ตัดต่อแล้ว 3 จาก 4</p>
      </section>
      <section className="space-y-3" aria-label="ระยะและการเคลื่อนไหว">
        <h3 className="text-lg font-semibold">ระยะ มุม และการเคลื่อนไหว</h3>
        <div className="flex flex-wrap items-end gap-3">
          {[1, 2, 3, 4, 6, 8].map((step) => (
            <div key={step} className="text-xs">
              <div className="bg-primary" style={{ width: `${step * 4}px`, height: `${step * 4}px` }} />
              {step * 4} px
            </div>
          ))}
        </div>
        <p className="text-sm">touch 44 px · section 24 px · page 16–32 px</p>
        <div className="flex flex-wrap gap-3">
          {['sm', 'md', 'lg', 'xl'].map((radius) => (
            <span
              key={radius}
              className="border bg-card p-3 text-sm"
              style={{ borderRadius: `var(--radius-${radius})` }}
            >
              {radius}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {['fast', 'normal', 'slow'].map((speed, index) => (
            <Button
              key={speed}
              variant="secondary"
              className="hover:-translate-y-1"
              style={{ transitionDuration: `var(--duration-${speed})` }}
            >
              {[120, 200, 320][index]} ms
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          ease-standard · โฟกัส 2 px ห่าง 3 px · ลดการเคลื่อนไหวตามการตั้งค่าเครื่อง
        </p>
      </section>
      <section className="space-y-3" aria-label="ปุ่ม">
        <h3 className="text-lg font-semibold">ปุ่ม</h3>
        <p className="text-sm text-muted-foreground">ชี้เพื่อดู hover · กดค้างเพื่อดู active · ใช้ Tab เพื่อดู focus</p>
        {(['default', 'secondary', 'ghost', 'destructive', 'outline', 'link'] as const).map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs">{variant}</span>
            <Button variant={variant}>บันทึก</Button>
            <Button variant={variant} disabled>
              ยังใช้ไม่ได้
            </Button>
            <Button variant={variant} loading>
              กำลังบันทึก…
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {(['xs', 'sm', 'default', 'lg', 'touch'] as const).map((size) => (
            <Button key={size} size={size} variant="secondary">
              ขนาด {size}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const).map((size) => (
            <Button key={size} size={size} aria-label={`เพิ่มข้อความ ${size}`} variant="outline">
              +
            </Button>
          ))}
        </div>
      </section>
      <section className="space-y-3" aria-label="ช่องกรอก">
        <h3 className="text-lg font-semibold">ช่องกรอก</h3>
        <Label htmlFor={`${id}-title`}>ชื่อคลิป</Label>
        <Input id={`${id}-title`} name="title" autoComplete="off" placeholder="เช่น ขายไว ไฟลุก…" />
        <Label htmlFor={`${id}-invalid`}>ชื่อที่ต้องแก้</Label>
        <Input id={`${id}-invalid`} aria-invalid="true" aria-describedby={`${id}-error`} defaultValue="" />
        <p id={`${id}-error`} className="text-sm text-destructive">
          กรอกชื่อคลิปก่อนบันทึก
        </p>
        <Input aria-label="ชื่อที่ปิดใช้งาน" disabled defaultValue="ขายไว ไฟลุก" />
        <Input aria-label="กำลังโหลดชื่อ" aria-busy="true" readOnly value="กำลังโหลด…" />
      </section>
      <section className="space-y-3" aria-label="ตัวเลือกและแท็บ">
        <h3 className="text-lg font-semibold">ตัวเลือกและแท็บ</h3>
        <SegmentedControl label="กรองคลิป" options={options} value={value} onValueChange={setValue} />
        <SegmentedControl
          label="กำลังโหลดตัวเลือก"
          options={options}
          value="all"
          onValueChange={setValue}
          state="loading"
        />
        <SegmentedControl
          label="ตัวเลือกปิดใช้งาน"
          options={options}
          value="all"
          onValueChange={setValue}
          state="disabled"
        />
        <Tabs defaultValue="captions">
          <TabsList aria-label="เครื่องมือตัดต่อ">
            <TabsTrigger value="captions">คำบรรยาย</TabsTrigger>
            <TabsTrigger value="style">สไตล์</TabsTrigger>
            <TabsTrigger value="crop" disabled>
              ครอบภาพ
            </TabsTrigger>
          </TabsList>
          <TabsContent value="captions">ตัดต่อแล้ว 3 จาก 4</TabsContent>
          <TabsContent value="style">ขายไว ไฟลุก</TabsContent>
          <TabsContent value="crop">ครอบภาพ</TabsContent>
        </Tabs>
        <Tabs defaultValue="loading" state="loading">
          <TabsList aria-label="กำลังโหลดเครื่องมือ">
            <TabsTrigger value="loading">กำลังโหลด…</TabsTrigger>
          </TabsList>
          <TabsContent value="loading">กำลังเตรียมเครื่องมือ…</TabsContent>
        </Tabs>
      </section>
      <section className="space-y-3" aria-label="ป้ายและการบันทึก">
        <h3 className="text-lg font-semibold">ป้ายและการบันทึก</h3>
        <div className="flex flex-wrap gap-2">
          {(['default', 'secondary', 'ai', 'success', 'warning', 'destructive', 'outline'] as const).map(
            (variant) => (
              <Badge key={variant} variant={variant}>
                {variant === 'ai' ? 'AI · แนะนำคำ' : variant}
              </Badge>
            ),
          )}
        </div>
        <SaveStatus state="saved" />
        <SaveStatus state="saving" />
        <SaveStatus state={save} onRetry={() => setSave('saved')} />
        <Button variant="ghost" onClick={() => setSave('error')}>
          แสดงข้อผิดพลาดอีกครั้ง
        </Button>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>ขายไว ไฟลุก</CardTitle>
          <CardDescription>ตัดต่อแล้ว 3 จาก 4</CardDescription>
        </CardHeader>
        <CardContent>
          <p>ตรวจคำบรรยายก่อนส่งออก</p>
        </CardContent>
      </Card>
      <div role="status" aria-label="กำลังโหลดคลิป" aria-busy="true" className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}

export function ComponentsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-page">
      <h1 className="text-3xl font-semibold">ชุดหน้าตา MyVideo</h1>
      <p className="text-muted-foreground">ตัวอย่างสำหรับตรวจหน้าตาและการใช้แป้นพิมพ์</p>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ComponentSurface />
        <ComponentSurface editor />
      </div>
    </main>
  );
}
