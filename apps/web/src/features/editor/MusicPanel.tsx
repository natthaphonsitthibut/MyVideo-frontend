import { type StageProject, withMusicTrack } from '@myvideo/stage';
import { useState, useSyncExternalStore } from 'react';
import { errorText } from '@/api/client';
import { useMusic, useUploadMusic } from '@/api/music';
import { Button } from '@/components/ui/button';
import type { EditorStore } from './editor-store';
import { splitAudioCut } from './split-audio';

export function MusicPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const music = useMusic(),
    upload = useUploadMusic(),
    [license, setLicense] = useState('');
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        เพลงจากคลังของคุณ
        <select
          value={value ?? ''}
          className="mt-1 w-full rounded-md border bg-background p-2"
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">ไม่ใส่เพลง</option>
          {music.data?.map((m) => (
            <option key={m.id} value={m.id} disabled={m.status !== 'ready'}>
              {m.title}
              {m.status === 'processing'
                ? ' · กำลังวัดจังหวะ'
                : m.status === 'failed'
                  ? ' · ไฟล์มีปัญหา'
                  : m.analysis?.bpm
                    ? ` · ≈${m.analysis.bpm} BPM`
                    : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        สิทธิ์ใช้เพลง (เช่น เพลงของร้าน หรือชื่อไลเซนส์)
        <input
          className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
          value={license}
          maxLength={300}
          onChange={(e) => setLicense(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        อัปโหลดเพลง (ไม่เกิน 30 MB)
        <input
          type="file"
          accept="audio/*"
          disabled={upload.isPending || !license.trim()}
          className="mt-1 block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate({ file, license: license.trim() });
            e.target.value = '';
          }}
        />
      </label>
      {upload.isPending ? (
        <p role="status" className="text-xs">
          กำลังอัปโหลดเพลง… เปลี่ยนหน้าได้ งานจะทำต่อ
        </p>
      ) : null}
      {music.data?.some((m) => m.status === 'processing') ? (
        <p role="status" className="animate-pulse text-xs motion-reduce:animate-none">
          กำลังวัดจังหวะเพลงเบื้องหลัง…
        </p>
      ) : null}
      {music.isError || upload.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {errorText(upload.error ?? music.error)}
        </p>
      ) : null}
      {music.data
        ?.filter((m) => m.status === 'failed')
        .map((m) => (
          <p key={m.id} className="text-xs text-destructive">
            {m.title}: {m.error}
          </p>
        ))}
    </div>
  );
}
export function MusicPanel({ store }: { store: EditorStore }) {
  const library = useMusic(),
    [picked, setPicked] = useState<string | null>(null),
    [error, setError] = useState('');
  const state = useSyncExternalStore(store.subscribe, () =>
    store
      .doc()
      .tracks.filter((t) => t.music)
      .map((t) => t.id)
      .join(','),
  );
  const add = () => {
    try {
      const m = library.data?.find((m) => m.id === picked);
      if (!m?.durationMs || !m.analysis) throw new Error('เลือกเพลงที่พร้อมก่อน');
      const durationMs = m.durationMs,
        analysis = m.analysis;
      const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
      store.run({
        label: 'set music',
        apply(draft) {
          const p = draft as unknown as StageProject;
          const old = p.tracks.filter((t) => t.music);
          for (const t of old)
            for (const id of t.elementIds) {
              const e = p.elements[id];
              if (e?.type === 'audio') {
                delete p.assets[e.assetId];
                delete p.elements[id];
              }
            }
          p.tracks = p.tracks.filter((t) => !t.music);
          let i = 0;
          const next = withMusicTrack(p, { musicId: m.id, durationMs, analysis }, () => {
            const id = ids[i++];
            if (!id) throw new Error('Missing music layer ID');
            return id;
          });
          p.assets = next.assets;
          p.elements = next.elements;
          p.tracks = next.tracks;
        },
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ใส่เพลงไม่ได้');
    }
  };
  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="เพลงและเสียง">
      <p className="font-medium">เพลงและเสียง</p>
      <MusicPicker value={picked} onChange={setPicked} />
      <Button variant="secondary" disabled={!picked} onClick={add}>
        ใส่เพลง · ลดเพลงตอนพูดอัตโนมัติ
      </Button>
      <p className="text-xs text-muted-foreground">
        ใช้จังหวะที่วัดได้จัดช่วงเพลง ลดเพลง 9 dB ระหว่างพูด พร้อมเสียงค่อยเข้าและค่อยออก
      </p>
      {state ? (
        <label className="block text-sm">
          ลดเพลงตอนพูด (dB)
          <input
            type="range"
            min={-24}
            max={0}
            defaultValue={-9}
            onPointerUp={(e) => {
              const gainDb = Number(e.currentTarget.value);
              store.run({
                label: 'music ducking',
                apply(d) {
                  for (const t of d.tracks) if (t.music && t.ducking) t.ducking.gainDb = gainDb;
                },
              });
            }}
            onKeyUp={(e) => {
              const gainDb = Number(e.currentTarget.value);
              store.run({
                label: 'music ducking',
                apply(d) {
                  for (const t of d.tracks) if (t.music && t.ducking) t.ducking.gainDb = gainDb;
                },
              });
            }}
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <SplitAudioControl store={store} />
    </section>
  );
}

function SplitAudioControl({ store }: { store: EditorStore }) {
  const ids = useSyncExternalStore(store.subscribe, () =>
    Object.values(store.doc().elements)
      .filter((e) => e.type === 'video')
      .map((e) => e.id)
      .join(','),
  );
  const [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  const cut = (kind: 'j' | 'l') => {
    try {
      const id = selected || ids.split(',')[0];
      if (!id) throw new Error('ไม่มีช็อตวิดีโอ');
      store.run(splitAudioCut(id, kind, crypto.randomUUID(), crypto.randomUUID()));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แยกเสียงไม่ได้');
    }
  };
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium">เสียงเหลื่อมภาพ (J/L cut)</p>
      <select
        aria-label="ช็อตสำหรับเหลื่อมเสียง"
        className="w-full rounded-md border bg-background p-2"
        value={selected || ids.split(',')[0] || ''}
        onChange={(e) => setSelected(e.target.value)}
      >
        {ids
          .split(',')
          .filter(Boolean)
          .map((id, i) => (
            <option key={id} value={id}>
              ช็อต {i + 1}
            </option>
          ))}
      </select>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => cut('j')}>
          เสียงมาก่อนภาพ
        </Button>
        <Button variant="outline" size="sm" onClick={() => cut('l')}>
          เสียงต่อหลังภาพ
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">แยกเป็นแทร็กเสียงให้ปรับขอบต่อได้ ตรวจฟังว่าขอบคำยังครบ</p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
