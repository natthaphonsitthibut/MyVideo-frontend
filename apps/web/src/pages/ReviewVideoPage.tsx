import { AlertTriangle, Camera, Check, Loader2, Wand2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  errorText,
  type ReviewVideoState,
  SHOT_ROLE_NAMES,
  type ShotRole,
  useCreateReviewVideo,
  useReviewVideo,
  useTemplates,
} from '@/api/review-videos';
import { formatDuration, useSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { chosenRoles, parsePoints, reviewStep, shotKey } from '@/features/review/review-flow';

const ROLES = Object.keys(SHOT_ROLE_NAMES) as ShotRole[];

/**
 * Review-to-Video (E10-F07): pick a few phone clips of one product, a template and the product's name/points → the
 * app sorts the shots into the template and opens the result in Quick Edit; when footage is missing it says what to
 * shoot, and the merchant can correct the shot types the app was unsure about.
 */
export function ReviewVideoPage() {
  const navigate = useNavigate();
  const sources = useSources();
  const templates = useTemplates();
  const create = useCreateReviewVideo();
  const [picked, setPicked] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState('review');
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, ShotRole>>({});
  const run = useReviewVideo(runId);
  const step = runId ? reviewStep(run.data) : null;

  useEffect(() => {
    if (step === 'ready' && run.data?.result?.projectId) navigate(`/clips/${run.data.result.projectId}/edit`);
  }, [step, run.data, navigate]);

  if (sources.isError) throw sources.error;
  const ready = (sources.data?.items ?? []).filter((s) => s.status === 'ready');
  const start = (extraRoles?: Record<string, ShotRole>) =>
    create.mutate(
      {
        sourceIds: picked,
        templateId,
        product: { name: name.trim(), points: parsePoints(points) },
        ...(extraRoles && Object.keys(extraRoles).length ? { roles: extraRoles } : {}),
      },
      { onSuccess: (s) => setRunId(s.runId) },
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    start();
  };

  return (
    <section className="page-layout max-w-3xl" data-testid="review-video-page">
      <h1 className="text-2xl font-semibold">สร้างวิดีโอรีวิวสินค้า</h1>
      <p className="text-sm text-muted-foreground">
        เลือกคลิปที่ถ่ายสินค้าชิ้นเดียวกัน 1–8 คลิป แอปจะแยกช็อตแล้วเรียงตามเทมเพลตให้ แก้ต่อได้ทุกอย่าง
      </p>
      <form onSubmit={submit} className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">1. คลิปของสินค้า</legend>
          {sources.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : ready.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีวิดีโอที่พร้อมใช้ —{' '}
              <Link to="/library" className="underline">
                อัปโหลดที่คลังวิดีโอ
              </Link>
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="review-sources">
              {ready.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 has-checked:border-primary has-checked:bg-primary/5">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && picked.length >= 8}
                        onChange={() => setPicked(on ? picked.filter((x) => x !== s.id) : [...picked, s.id])}
                        data-testid="review-source"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDuration(s.durationMs)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">2. เทมเพลต</legend>
          <div className="grid gap-2 sm:grid-cols-3" data-testid="review-templates">
            {(templates.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                data-selected={t.id === templateId}
                onClick={() => setTemplateId(t.id)}
                className="rounded-lg border bg-card p-3 text-left text-sm hover:bg-muted data-[selected=true]:border-primary data-[selected=true]:bg-primary/10"
                data-testid={`template-${t.id}`}
              >
                <span className="block font-medium">{t.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  ต้องมี:{' '}
                  {[
                    ...new Set(
                      t.slots.filter((x) => x.required).map((x) => SHOT_ROLE_NAMES[x.accepts[0] as ShotRole]),
                    ),
                  ].join(', ')}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">3. ข้อมูลสินค้า (ใช้ข้อความของคุณเท่านั้น)</legend>
          <div className="space-y-1">
            <Label htmlFor="product-name">ชื่อสินค้า</Label>
            <Input
              id="product-name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="review-product-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-points">จุดเด่น (บรรทัดละ 1 ข้อ ไม่เกิน 4 ข้อ)</Label>
            <textarea
              id="product-points"
              rows={4}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="block w-full rounded-md border bg-background px-3 py-2 text-base"
              data-testid="review-product-points"
            />
          </div>
        </fieldset>
        <Button
          type="submit"
          disabled={picked.length === 0 || !name.trim() || create.isPending || step === 'analysing'}
          data-testid="review-start"
        >
          <Wand2 />
          สร้างวิดีโอ
        </Button>
        {create.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {errorText(create.error)}
          </p>
        ) : null}
      </form>

      {step === 'analysing' ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          data-testid="review-analysing"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          กำลังดูคลิปทีละช็อตและจัดลงเทมเพลต…
        </p>
      ) : null}
      {step === 'failed' ? (
        <p className="text-sm text-destructive" role="alert">
          {run.data?.error ?? 'สร้างวิดีโอไม่สำเร็จ ลองอีกครั้ง'}
        </p>
      ) : null}
      {step === 'missing' && run.data ? (
        <Missing
          state={run.data}
          roles={roles}
          setRoles={setRoles}
          onRetry={() => start(chosenRoles(run.data?.result?.shots ?? [], roles))}
          busy={create.isPending}
        />
      ) : null}
    </section>
  );
}

function Missing({
  state,
  roles,
  setRoles,
  onRetry,
  busy,
}: {
  state: ReviewVideoState;
  roles: Record<string, ShotRole>;
  setRoles: (r: Record<string, ShotRole>) => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const shots = state.result?.shots ?? [];
  return (
    <div
      className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
      data-testid="review-missing"
    >
      <h2 className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4 text-amber-500" aria-hidden />
        ยังขาดช็อตนี้
      </h2>
      <ul className="space-y-2">
        {(state.result?.missing ?? []).map((m) => (
          <li
            key={`${m.slot}-${m.roles.join()}`}
            className="flex gap-2 text-sm"
            data-testid="review-missing-item"
          >
            <Camera className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>{m.roles.map((r) => SHOT_ROLE_NAMES[r]).join(' หรือ ')}</strong> — {m.hint}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        ถ้ามีช็อตแบบนี้อยู่แล้วแต่แอปจัดประเภทผิด เลือกประเภทที่ถูกด้านล่างแล้วกด “ลองใหม่” หรือถ่ายเพิ่มแล้วอัปโหลด
      </p>
      <ul className="max-h-80 space-y-1 overflow-y-auto" data-testid="review-shots">
        {shots.map((s) => (
          <li key={shotKey(s)} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
              {formatDuration(s.startMs)}–{formatDuration(s.endMs)}
            </span>
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={roles[shotKey(s)] ?? s.role}
              onChange={(e) => setRoles({ ...roles, [shotKey(s)]: e.target.value as ShotRole })}
              aria-label={`ประเภทช็อต ${formatDuration(s.startMs)}`}
              data-testid="review-shot-role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {SHOT_ROLE_NAMES[r]}
                </option>
              ))}
            </select>
            {s.needsChoice ? (
              <span className="text-xs text-amber-600">ไม่แน่ใจ — ช่วยเลือก</span>
            ) : s.chosenByMerchant ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3" aria-hidden />
                คุณเลือก
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{s.reason}</span>
            )}
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={onRetry} disabled={busy} data-testid="review-retry">
        ลองใหม่
      </Button>
    </div>
  );
}
