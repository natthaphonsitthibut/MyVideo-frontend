import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiErrorMessage, useRestyle, useRunStatus, useStylePacks } from '@/api/clips';
import { projectKey } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { restyleView } from './restyle-state';

/**
 * Switch an AI clip to another edit style. The server rebuilds it from the same words and cuts (no AI call) and
 * saves a new version, so the preview simply shows the new current version when the run ends.
 */
export function StylePicker({ projectId, currentStyleId }: { projectId: string; currentStyleId: string }) {
  const qc = useQueryClient();
  const packs = useStylePacks();
  const restyle = useRestyle(projectId);
  const [runId, setRunId] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const run = useRunStatus(runId);
  const view = restyleView({
    requesting: restyle.isPending,
    requestError: restyle.isError ? apiErrorMessage(restyle.error) : null,
    run: run.data,
  });
  const busy = view.kind === 'working';

  useEffect(() => {
    if (view.kind !== 'done') return;
    void qc.invalidateQueries({ queryKey: projectKey(projectId) }).then(() => {
      setRunId(null);
      setTarget(null);
    });
  }, [view.kind, qc, projectId]);

  const choose = (styleId: string) => {
    if (busy || styleId === currentStyleId) return;
    setTarget(styleId);
    setRunId(null);
    restyle.mutate(styleId, { onSuccess: setRunId });
  };
  // while working, the chosen style is shown as selected; otherwise the clip's own style
  const selected = busy && target ? target : currentStyleId;

  return (
    <section className="space-y-3 rounded-xl border bg-card px-4 py-3" aria-labelledby="style-title">
      <div className="space-y-0.5">
        <h2 id="style-title" className="font-semibold">
          สไตล์การตัดต่อ
        </h2>
        <p className="text-xs text-muted-foreground">
          เปลี่ยนได้ทันทีจากคำพูดเดิม ไม่ต้องให้ AI วิเคราะห์ใหม่ · เวอร์ชันก่อนหน้ายังเก็บไว้
        </p>
      </div>
      <fieldset disabled={busy} className="grid gap-2" data-testid="style-picker" aria-busy={busy}>
        <legend className="sr-only">เลือกสไตล์</legend>
        {(packs.data ?? []).map((p) => {
          const on = p.id === selected;
          return (
            <label
              key={p.id}
              data-testid={`style-${p.id}`}
              data-selected={on}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                on ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
                busy && 'cursor-wait opacity-70',
              )}
            >
              <input
                type="radio"
                name={`style-${projectId}`}
                value={p.id}
                checked={on}
                onChange={() => choose(p.id)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {p.name}
                  {p.id === currentStyleId ? (
                    <span className="ml-2 text-xs text-muted-foreground">(ใช้อยู่)</span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div aria-live="polite" className="text-sm">
        {busy ? (
          <p className="flex items-center gap-2 text-muted-foreground" data-testid="restyle-working">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            กำลังเปลี่ยนสไตล์…
          </p>
        ) : view.kind === 'failed' ? (
          <div className="flex flex-wrap items-center gap-2" role="alert">
            <p className="text-destructive">{view.message}</p>
            {target ? (
              <Button size="sm" variant="outline" onClick={() => choose(target)}>
                <RotateCcw />
                ลองใหม่
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
