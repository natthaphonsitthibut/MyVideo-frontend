import { Check, ChevronLeft, ChevronRight, Pencil, Sparkles, Undo2, X } from 'lucide-react';
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
  onClose,
}: {
  aiFixed: number;
  targets: readonly ReviewTarget[];
  focus: number | null;
  busy: boolean;
  onStep: (dir: 1 | -1) => void;
  onAccept: (t: ReviewTarget) => void;
  onEdit: (t: ReviewTarget) => void;
  onRevert: (t: ReviewTarget) => void;
  onClose: () => void;
}) {
  if (aiFixed === 0) return null;
  const current = focus !== null ? targets[focus] : undefined;
  // optional: the AI's wording is already used as is; walking through it is only for the merchant who wants to
  return (
    <section
      className={
        current
          ? 'space-y-2 rounded-lg border border-amber-300/70 bg-amber-50 p-2 text-sm text-amber-950'
          : 'flex flex-wrap items-center gap-2 text-xs text-muted-foreground'
      }
      data-testid="review-bar"
      aria-label="คำที่ AI ปรับ"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-3.5" aria-hidden />
        <span data-testid="review-count">AI ปรับให้อ่านเป็นภาษาพูด {aiFixed} คำ · ใช้ได้เลย ไม่ต้องตรวจ</span>
        {targets.length > 0 ? (
          <span className="ml-auto flex gap-1">
            {current ? (
              <Button size="sm" variant="outline" onClick={() => onStep(-1)} aria-label="คำก่อนหน้า">
                <ChevronLeft />
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={current ? 'outline' : 'ghost'}
              className={current ? undefined : 'h-6 px-2 text-xs'}
              onClick={() => onStep(1)}
              data-testid="review-next"
            >
              {current ? 'คำถัดไป' : 'ดูทีละคำ'}
              <ChevronRight />
            </Button>
            {current ? (
              <Button size="sm" variant="ghost" onClick={onClose} data-testid="review-close">
                <X />
                ปิด
              </Button>
            ) : null}
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
