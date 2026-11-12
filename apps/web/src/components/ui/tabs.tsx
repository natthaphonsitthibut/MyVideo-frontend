import { type ComponentProps, createContext, useContext, useId, useState } from 'react';
import { cn } from '../../lib/utils';

const TabsContext = createContext<{
  value: string;
  select: (value: string) => void;
  id: string;
  state: 'ready' | 'loading' | 'disabled';
} | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be inside Tabs');
  return context;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  state = 'ready',
  children,
  className,
  ...props
}: ComponentProps<'div'> & {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  state?: 'ready' | 'loading' | 'disabled';
}) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const id = useId();
  return (
    <TabsContext.Provider
      value={{
        value: value ?? localValue,
        id,
        state,
        select: (next) => {
          setLocalValue(next);
          onValueChange?.(next);
        },
      }}
    >
      <div aria-busy={state === 'loading'} className={cn('min-w-0 space-y-4', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      role="tablist"
      aria-orientation="horizontal"
      className={cn('flex max-w-full gap-1 overflow-x-auto border-b p-1', className)}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  disabled,
  onKeyDown,
  onClick,
  ...props
}: ComponentProps<'button'> & { value: string }) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  const unavailable = disabled || tabs.state !== 'ready';
  return (
    <button
      {...props}
      type="button"
      role="tab"
      id={`${tabs.id}-tab-${value}`}
      aria-controls={`${tabs.id}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={unavailable}
      className={cn('choice-control shrink-0', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !unavailable) tabs.select(value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || unavailable) return;
        const items = Array.from(
          event.currentTarget
            .closest('[role="tablist"]')
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
        );
        const index = items.indexOf(event.currentTarget);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowRight'
                ? (index + 1) % items.length
                : event.key === 'ArrowLeft'
                  ? (index - 1 + items.length) % items.length
                  : -1;
        if (next < 0) return;
        event.preventDefault();
        items[next]?.focus();
        items[next]?.click();
      }}
    />
  );
}

export function TabsContent({ value, className, ...props }: ComponentProps<'div'> & { value: string }) {
  const tabs = useTabs();
  return (
    <div
      {...props}
      role="tabpanel"
      id={`${tabs.id}-panel-${value}`}
      aria-labelledby={`${tabs.id}-tab-${value}`}
      hidden={tabs.value !== value}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: tab panels need a keyboard entry point when their content is text
      tabIndex={0}
      className={cn('rounded-md', className)}
    />
  );
}
