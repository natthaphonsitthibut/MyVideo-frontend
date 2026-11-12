import { Check, ChevronLeft, ChevronRight, Pencil, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReviewTarget } from './review-queue';

/**
 * "AI แก้ให้ N คำ · รอตรวจ M": walk the AI corrections one by one and accept, edit or go back to the heard word.
 * Only the focused target is React state; the word marks themselves are data attributes on the transcript.
 */
export function ReviewBar({
  aiFixed,
  targets,
  focus,
  busy,
  onStep,
  onAccept,
  onEdit,
  onRevert,
}: {
  aiFixed: number;
  targets: readonly ReviewTarget[];
  focus: number | null;
  busy: boolean;
  onStep: (dir: 1 | -1) => void;
  onAccept: (t: ReviewTarget) => void;
  onEdit: (t: ReviewTarget) => void;
  onRevert: (t: ReviewTarget) => void;
}) {
  if (aiFixed === 0) return null;
  const current = focus !== null ? targets[focus] : undefined;
  return (
    <section
      className="space-y-2 rounded-lg border border-amber-300/70 bg-amber-50 p-2 text-sm text-amber-950"
      data-testid="review-bar"
      aria-label="ตรวจคำที่ AI แก้"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-amber-600" aria-hidden />
        <span className="font-medium" data-testid="review-count">
          {targets.length > 0
            ? `AI แก้ให้ ${aiFixed} คำ · รอตรวจ ${targets.length}`
            : `AI แก้ให้ ${aiFixed} คำ · ตรวจครบแล้ว`}
        </span>
        {targets.length > 0 ? (
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onStep(-1)} aria-label="คำก่อนหน้า">
              <ChevronLeft />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onStep(1)} data-testid="review-next">
              {current ? 'คำถัดไป' : 'เริ่มตรวจ'}
              <ChevronRight />
            </Button>
          </span>
        ) : null}
      </div>
      {current ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="review-current">
          <span>
            ได้ยิน “{current.heard ?? '—'}” → AI แก้เป็น <strong>“{current.text}”</strong>
          </span>
          <span className="flex flex-wrap gap-1">
            <Button size="sm" disabled={busy} onClick={() => onAccept(current)} data-testid="review-accept">
              <Check />
              ถูกแล้ว
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(current)}>
              <Pencil />
              แก้เอง
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRevert(current)}>
              <Undo2 />
              คืนคำที่ได้ยิน
            </Button>
          </span>
        </div>
      ) : null}
    </section>
  );
}
