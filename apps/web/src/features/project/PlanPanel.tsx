import { Check, Circle, CircleAlert, Clock, LoaderCircle, Minus, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { errorText } from '@/api/client';
import {
  type FolderPlan,
  useChooseFolderStyle,
  useFolderPlan,
  useStartFolderEdit,
  useUnlockEditingStyle,
} from '@/api/folders';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Step = FolderPlan['steps'][number];

const ICON: Record<Step['state'], typeof Check> = {
  done: Check,
  running: LoaderCircle,
  waiting: Clock,
  failed: CircleAlert,
  skipped: Minus,
  pending: Circle,
};

function StepRow({ step }: { step: Step }) {
  const Icon = ICON[step.state];
  return (
    <li className="flex gap-3 py-2.5" data-testid={`plan-step-${step.id}`} data-state={step.state}>
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
          step.state === 'done' && 'bg-success/15 text-success',
          step.state === 'running' && 'bg-primary/10 text-primary',
          step.state === 'waiting' && 'bg-warning/10 text-warning',
          step.state === 'failed' && 'bg-destructive/10 text-destructive',
          (step.state === 'pending' || step.state === 'skipped') && 'text-muted-foreground',
        )}
      >
        <Icon aria-hidden className={cn('size-3.5', step.state === 'running' && 'animate-spin')} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              step.state === 'pending' || step.state === 'skipped' ? 'text-muted-foreground' : 'font-medium',
            )}
          >
            {step.label}
          </span>
          {step.state === 'running' ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">กำลังทำ</span>
          ) : null}
          {step.state === 'waiting' ? (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">รอคุณเลือก</span>
          ) : null}
          {step.state === 'skipped' ? <span className="text-xs text-muted-foreground">(ข้าม)</span> : null}
        </p>
        {step.detail && step.state !== 'waiting' ? (
          <p className="text-xs text-muted-foreground">{step.detail}</p>
        ) : null}
        {step.error ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {step.error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function StylePick({ plan, folderId }: { plan: FolderPlan; folderId: string }) {
  const choose = useChooseFolderStyle(folderId);
  const [picked, setPicked] = useState(plan.proposals[0]?.styleId ?? '');
  const [lockStyle, setLockStyle] = useState(false);
  const ranked = plan.proposals.some((p) => p.origin !== 'catalogue');
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3" data-testid="folder-style-pick">
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 font-medium">
          <Wand2 className="size-4 text-primary" aria-hidden />
          เลือกสไตล์การตัดต่อ
        </p>
        <p className="text-xs text-muted-foreground">
          {ranked
            ? `${plan.proposals[0]?.origin === 'ai' ? 'AI' : 'ระบบ'}ดูฟุตเทจของคุณแล้วเรียงจากเหมาะที่สุด`
            : 'ฟุตเทจนี้ไม่มีเสียงพูดให้วิเคราะห์ เลือกสไตล์ที่ชอบได้เลย'}
        </p>
      </div>
      <fieldset className="grid gap-2" disabled={choose.isPending}>
        <legend className="sr-only">สไตล์</legend>
        {plan.proposals.map((p, i) => {
          const on = p.styleId === picked;
          return (
            <label
              key={p.styleId}
              data-testid={`proposal-${p.styleId}`}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2 transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                on ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
              )}
            >
              <input
                type="radio"
                name={`folder-style-${folderId}`}
                value={p.styleId}
                checked={on}
                onChange={() => setPicked(p.styleId)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {p.name}
                  {i === 0 && p.origin !== 'catalogue' ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">แนะนำ</span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">{p.reason ?? p.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {choose.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {errorText(choose.error)}
        </p>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={lockStyle}
          onChange={(e) => setLockStyle(e.target.checked)}
          disabled={choose.isPending}
        />
        ล็อกสไตล์นี้ ใช้กับโปรเจกต์ใหม่ด้วย
      </label>
      <Button
        disabled={choose.isPending || !picked}
        onClick={() => choose.mutate({ styleId: picked, lockStyle })}
      >
        <Sparkles />
        ตัดต่อด้วยสไตล์นี้
      </Button>
    </div>
  );
}

export function PlanPanel({ folderId, sourceIds }: { folderId: string; sourceIds: string[] }) {
  const plan = useFolderPlan(folderId);
  const start = useStartFolderEdit(folderId);
  const unlock = useUnlockEditingStyle();
  if (plan.isPending) return <Skeleton className="h-64" />;
  if (plan.isError)
    return (
      <p role="alert" className="text-sm">
        โหลดแผนงานไม่ได้{' '}
        <Button variant="ghost" onClick={() => plan.refetch()}>
          ลองอีกครั้ง
        </Button>
      </p>
    );
  const p = plan.data;
  const open = !!p.runId && !p.finished && !p.failed;
  return (
    <section aria-labelledby="plan-heading" className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-heading" className="text-lg font-semibold">
          แผนงาน
        </h2>
        {p.runId ? (
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="plan-progress">
            เสร็จ {p.done}/{p.total}
          </span>
        ) : null}
      </div>
      <ol className="divide-y" aria-label="ขั้นตอนการตัดต่อ">
        {p.steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </ol>
      {p.lockedStyle ? (
        <div className="space-y-1 rounded-md bg-primary/5 px-3 py-2 text-sm">
          <p>
            สไตล์ที่ล็อก: <strong>{p.lockedStyle.name}</strong>
          </p>
          <p className="text-xs text-muted-foreground">เริ่มรอบใหม่ด้วยสไตล์นี้อัตโนมัติ ค่าของงานที่เริ่มแล้วจะคงเดิม</p>
          <Button variant="ghost" size="sm" disabled={unlock.isPending} onClick={() => unlock.mutate()}>
            ยกเลิกล็อกสไตล์
          </Button>
          {unlock.isError ? <p role="alert">{errorText(unlock.error)}</p> : null}
        </div>
      ) : null}
      {p.needs === 'style' && p.proposals.length ? <StylePick plan={p} folderId={folderId} /> : null}
      {!open ? (
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={!sourceIds.length || start.isPending}
            onClick={() => start.mutate(sourceIds)}
            data-testid="folder-start"
          >
            <Sparkles />
            {p.failed ? 'เริ่มใหม่อีกครั้ง' : p.finished ? 'ตัดต่ออีกรอบ' : 'เริ่มตัดต่อ'}
          </Button>
          {!sourceIds.length ? (
            <p className="text-xs text-muted-foreground">เลือกฟุตเทจอย่างน้อย 1 ไฟล์ แล้วค่อยเริ่มตัดต่อ</p>
          ) : null}
          {start.isError ? (
            <p role="alert" className="text-xs text-destructive">
              {errorText(start.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
