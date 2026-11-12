import { useId, useRef } from 'react';
import { cn } from '../../lib/utils';

type Option = { value: string; label: string; disabled?: boolean };

export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
  state = 'ready',
  className,
}: {
  label: string;
  options: readonly Option[];
  value: string;
  onValueChange: (value: string) => void;
  state?: 'ready' | 'disabled' | 'loading';
  className?: string;
}) {
  const name = useId();
  const refs = useRef(new Map<string, HTMLInputElement>());
  const enabled = options.filter((option) => !option.disabled);
  const entry = enabled.find((option) => option.value === value)?.value ?? enabled[0]?.value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-busy={state === 'loading'}
      className={cn('flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1', className)}
    >
      {options.map((option) => (
        <label key={option.value} className="relative">
          <input
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={state !== 'ready' || option.disabled}
            tabIndex={entry === option.value ? 0 : -1}
            className="peer sr-only"
            onChange={() => {
              // never change while busy/disabled, even if a click still reaches the input
              if (state === 'ready' && !option.disabled) onValueChange(option.value);
            }}
            onKeyDown={(event) => {
              if (state !== 'ready' || option.disabled) return;
              const index = enabled.findIndex((item) => item.value === option.value);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? enabled.length - 1
                    : ['ArrowRight', 'ArrowDown'].includes(event.key)
                      ? (index + 1) % enabled.length
                      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                        ? (index - 1 + enabled.length) % enabled.length
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              const target = enabled[next];
              if (target) {
                onValueChange(target.value);
                refs.current.get(target.value)?.focus();
              }
            }}
          />
          <span className="choice-control block peer-checked:bg-card peer-checked:text-primary peer-checked:shadow-[inset_0_-2px_var(--primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:pointer-events-none peer-disabled:opacity-50">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
