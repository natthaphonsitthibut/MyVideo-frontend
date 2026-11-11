import type { LucideIcon } from 'lucide-react';

/** An honest empty state: says what will appear here, never shows sample data. */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <Icon className="mb-3 size-10 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
