import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { API_BASE_URL, errorText } from '@/api/client';
import { useCreateReferenceStyle, useReferenceAction, useReferenceStyles } from '@/api/reference-styles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadPanel } from '@/features/upload/UploadPanel';

export function ReferenceStylesPage() {
  const refs = useReferenceStyles(),
    create = useCreateReferenceStyle(),
    retry = useReferenceAction('retry'),
    lock = useReferenceAction('lock');
  const [title, setTitle] = useState('สไตล์ของฉัน'),
    [preview, setPreview] = useState<string | null>(null),
    [locked, setLocked] = useState<string | null>(null);
  const failure = create.error ?? retry.error ?? lock.error;
  return (
    <section className="page-layout space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">คลิปอ้างอิง</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          เรียนรู้จังหวะตัด สี และพื้นที่ซับจากคลิปตัวอย่างไม่เกิน 2 นาที แล้วใช้กับฟุตเทจของคุณ ภาพ ข้อความ โลโก้
          และเสียงของคลิปอ้างอิงจะไม่ถูกนำไปใส่ในงานตัด
        </p>
      </header>
      <div className="space-y-2">
        <Label htmlFor="reference-title">ชื่อสไตล์ใหม่</Label>
        <Input
          id="reference-title"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">อัปโหลดทีละคลิปเพื่อให้แต่ละสไตล์มีชื่อชัดเจน</p>
      </div>
      {title.trim() ? (
        <UploadPanel
          kind="video"
          onSourceReady={async (sourceId) => {
            await create.mutateAsync({ sourceId, title: title.trim() });
          }}
        />
      ) : (
        <p className="text-sm">ตั้งชื่อสไตล์ก่อนอัปโหลด</p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(failure)}
        </p>
      )}
      {refs.isPending && (
        <p role="status" className="flex gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          กำลังโหลดคลิปอ้างอิง
        </p>
      )}
      {refs.isError && <p role="alert">{errorText(refs.error)}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {refs.data?.map((r) => (
          <article key={r.id} className="space-y-4 rounded-xl border p-4">
            <div>
              <h2 className="font-medium break-words">{r.title}</h2>
              <p className="text-xs text-muted-foreground">คลิปอ้างอิง · แยกจากฟุตเทจ</p>
            </div>
            {['waiting', 'processing'].includes(r.status) && (
              <p role="status" className="flex items-center gap-2 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                {r.status === 'waiting' ? 'กำลังเตรียมคลิป' : 'กำลังวิเคราะห์จังหวะและลักษณะข้อความ'}
              </p>
            )}
            {r.grammar && (
              <div className="space-y-2 text-sm">
                <p>
                  ช่วงภาพมัธยฐาน {(r.grammar.medianShotMs / 1000).toFixed(1)} วินาที ·{' '}
                  {Math.max(0, r.grammar.cutsMs.length - 2)} จุดตัด
                </p>
                <p>
                  จังหวะเสียงโดยประมาณ {r.grammar.rhythm?.bpm ? `${r.grammar.rhythm.bpm} BPM` : 'ยังระบุไม่ได้'}
                </p>
                <p>
                  พื้นที่ซับ{' '}
                  {r.grammar.captionBand === null
                    ? 'ยังวัดไม่ได้ ใช้ตำแหน่งมาตรฐาน'
                    : `${Math.round(r.grammar.captionBand * 100)}% ของความสูงภาพ`}
                </p>
                <figure className="flex gap-1" aria-label="สีที่วัดจากคลิป">
                  {r.grammar.colours.map((c) => (
                    <span
                      key={c}
                      className="size-6 rounded border"
                      title={c}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </figure>
                <p className="text-xs text-muted-foreground">วัดจากภาพตัวอย่างบางเฟรม ตรวจผลกับฟุตเทจของคุณอีกครั้ง</p>
              </div>
            )}
            {r.error && <p className="text-sm text-destructive">{r.error}</p>}
            <div className="flex flex-wrap gap-2">
              {r.sourceStatus === 'ready' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreview(preview === r.id ? null : r.id)}
                >
                  {preview === r.id ? 'ปิดตัวอย่าง' : 'ดูคลิปอ้างอิง'}
                </Button>
              )}
              {r.status === 'ready' && (
                <Button
                  size="sm"
                  disabled={lock.isPending}
                  onClick={() => lock.mutate(r.id, { onSuccess: () => setLocked(r.id) })}
                >
                  {locked === r.id ? 'ล็อกสไตล์แล้ว' : 'ล็อกใช้สไตล์นี้'}
                </Button>
              )}
              {r.status === 'failed' && r.sourceStatus === 'ready' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(r.id)}
                >
                  ลองวิเคราะห์ใหม่
                </Button>
              )}
            </div>
            {locked === r.id && (
              <p role="status" className="text-sm">
                โปรเจกต์ใหม่จะใช้สไตล์นี้อัตโนมัติ{' '}
                <Link className="underline" to="/projects">
                  ไปโปรเจกต์
                </Link>
              </p>
            )}
            {preview === r.id && (
              <video
                controls
                preload="metadata"
                className="max-h-96 w-full rounded-lg bg-black"
                src={`${API_BASE_URL}/sources/${r.sourceId}/assets/proxy`}
              >
                <track kind="captions" />
              </video>
            )}
          </article>
        ))}
      </div>
      {refs.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">ยังไม่มีคลิปอ้างอิง อัปโหลดตัวอย่างที่อยากเรียนรู้จังหวะตัดได้เลย</p>
      )}
    </section>
  );
}
