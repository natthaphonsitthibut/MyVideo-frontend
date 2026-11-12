import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { Button } from './button';

export function SaveStatus({
  state,
  onRetry,
}: {
  state: 'saved' | 'saving' | 'error';
  onRetry?: () => void;
}) {
  const Icon = state === 'saved' ? Check : state === 'saving' ? LoaderCircle : CircleAlert;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`inline-flex items-center gap-2 ${state === 'error' ? 'text-destructive' : state === 'saved' ? 'text-success' : 'text-muted-foreground'}`}
      >
        <Icon aria-hidden="true" className={`size-4 shrink-0 ${state === 'saving' ? 'animate-spin' : ''}`} />
        {state === 'saved' ? 'บันทึกแล้ว' : state === 'saving' ? 'กำลังบันทึก…' : 'บันทึกไม่สำเร็จ — ลองใหม่'}
      </span>
      {state === 'error' && onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          ลองใหม่
        </Button>
      ) : null}
    </div>
  );
}
