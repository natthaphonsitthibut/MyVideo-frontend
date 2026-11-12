import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorText, useReviewVideo, useSwapTemplate, useTemplates } from '@/api/review-videos';
import { reviewStep } from '@/features/review/review-flow';

/**
 * Swap template (E10-F08): the same footage in another template, saved as a NEW version of this project (the old one
 * stays in the version history). The page reloads the project when the new version is ready.
 */
export function TemplatePanel({
  projectId,
  currentId,
  onSwapped,
}: {
  projectId: string;
  currentId: string;
  onSwapped: () => void;
}) {
  const templates = useTemplates();
  const swap = useSwapTemplate(projectId);
  const [runId, setRunId] = useState<string | null>(null);
  const run = useReviewVideo(runId);
  const step = runId ? reviewStep(run.data) : null;
  useEffect(() => {
    if (step === 'ready') onSwapped();
  }, [step, onSwapped]);
  return (
    <div className="space-y-3" data-testid="template-panel">
      <p className="text-sm text-muted-foreground">
        ใช้ฟุตเทจเดิมกับเทมเพลตอื่น — ได้เวอร์ชันใหม่ของคลิปนี้ (การแก้ข้อความของคุณในเวอร์ชันนี้จะไม่ติดไป)
      </p>
      <div className="grid gap-2">
        {(templates.data ?? []).map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.id === currentId || swap.isPending || step === 'analysing'}
            onClick={() => swap.mutate(t.id, { onSuccess: (s) => setRunId(s.runId) })}
            className="rounded-lg border bg-card p-3 text-left text-sm hover:bg-muted disabled:opacity-60"
            data-testid={`swap-${t.id}`}
          >
            <span className="font-medium">{t.name}</span>
            {t.id === currentId ? <span className="ml-2 text-xs text-muted-foreground">(ใช้อยู่)</span> : null}
            <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
          </button>
        ))}
      </div>
      {step === 'analysing' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          กำลังจัดคลิปลงเทมเพลตใหม่…
        </p>
      ) : null}
      {step === 'missing' ? (
        <p className="text-sm text-amber-600" role="alert">
          ฟุตเทจไม่พอสำหรับเทมเพลตนี้: {run.data?.result?.missing.map((m) => m.hint).join(' · ')}
        </p>
      ) : null}
      {swap.isError || step === 'failed' ? (
        <p className="text-sm text-destructive" role="alert">
          {swap.isError ? errorText(swap.error) : 'เปลี่ยนเทมเพลตไม่สำเร็จ'}
        </p>
      ) : null}
    </div>
  );
}
