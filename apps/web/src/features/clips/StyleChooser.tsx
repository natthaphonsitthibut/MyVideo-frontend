import { Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { ClipsState } from '@/api/clips';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Advice = NonNullable<ClipsState['advice']>;

/**
 * After the analysis: the styles ranked for this video with the reason, best first and pre-selected. The merchant
 * picks ONE and only then the clips are edited.
 */
export function StyleChooser({
  advice,
  clipCount,
  starting,
  onStart,
}: {
  advice: Advice;
  clipCount: number;
  starting: boolean;
  onStart: (styleId: string) => void;
}) {
  const [picked, setPicked] = useState(advice.items[0]?.styleId ?? '');
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3" data-testid="style-chooser">
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 font-medium">
          <Wand2 className="size-4 text-primary" aria-hidden />
          เลือกสไตล์การตัดต่อ
        </p>
        <p className="text-xs text-muted-foreground">
          {advice.origin === 'ai' ? 'AI ' : 'ระบบ'}ดูวิดีโอนี้แล้วแนะนำเรียงจากเหมาะที่สุด · เจอ {clipCount} ช่วงที่น่าตัด
          เลือกแล้วจึงเริ่มตัดต่อ
        </p>
      </div>
      <fieldset className="grid gap-2" disabled={starting}>
        <legend className="sr-only">สไตล์</legend>
        {advice.items.map((a, i) => {
          const on = a.styleId === picked;
          return (
            <label
              key={a.styleId}
              data-testid={`advice-${a.styleId}`}
              data-selected={on}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2 transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                on ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
              )}
            >
              <input
                type="radio"
                name="clip-style"
                value={a.styleId}
                checked={on}
                onChange={() => setPicked(a.styleId)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {a.name}
                  {i === 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">แนะนำ</span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">{a.reason}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <Button data-testid="clips-build" disabled={starting || !picked} onClick={() => onStart(picked)}>
        <Sparkles />
        เริ่มตัดต่อด้วยสไตล์นี้
      </Button>
    </div>
  );
}
