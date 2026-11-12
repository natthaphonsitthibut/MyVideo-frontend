import { formatTimecode } from '@myvideo/timeline-core';
import { useRef } from 'react';
import type { EditorStore } from './editor-store';
import { trimClip } from './trim';

/**
 * Simple trim (E08-F09): one bar for the whole clip with a start and an end handle (native range inputs — keyboard
 * and screen-reader ready). Dragging only moves the shading (no React render, no stage work); release commits one
 * trim command.
 */
export function TrimBar({ store, durationFrames }: { store: EditorStore; durationFrames: number }) {
  const fps = store.doc().fps;
  const one = Math.round(fps.num / fps.den);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const shadeIn = useRef<HTMLDivElement>(null);
  const shadeOut = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  const values = () => ({
    a: Number(startRef.current?.value ?? 0),
    b: Number(endRef.current?.value ?? durationFrames),
  });
  const paint = () => {
    const { a, b } = values();
    if (shadeIn.current) shadeIn.current.style.width = `${(a / durationFrames) * 100}%`;
    if (shadeOut.current) shadeOut.current.style.width = `${((durationFrames - b) / durationFrames) * 100}%`;
    if (label.current) label.current.textContent = `ความยาว ${formatTimecode(Math.max(0, b - a), fps)}`;
  };
  const clampAndPaint = (which: 'a' | 'b') => {
    const { a, b } = values();
    if (which === 'a' && a > b - one && startRef.current) startRef.current.value = String(b - one);
    if (which === 'b' && b < a + one && endRef.current) endRef.current.value = String(a + one);
    paint();
  };
  const commit = () => {
    const { a, b } = values();
    if (a === 0 && b === durationFrames) return;
    store.run(trimClip(a, b));
  };

  return (
    <div className="space-y-1" data-testid="trim-bar">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>ตัดหัว–ท้ายคลิป</span>
        <span ref={label} className="tabular-nums">
          ความยาว {formatTimecode(durationFrames, fps)}
        </span>
      </div>
      <div className="relative h-10 rounded-md bg-muted">
        <div
          ref={shadeIn}
          className="absolute inset-y-0 left-0 rounded-l-md bg-black/60"
          style={{ width: 0 }}
        />
        <div
          ref={shadeOut}
          className="absolute inset-y-0 right-0 rounded-r-md bg-black/60"
          style={{ width: 0 }}
        />
        {(['a', 'b'] as const).map((which) => (
          <input
            key={`${which}-${durationFrames}`}
            ref={which === 'a' ? startRef : endRef}
            type="range"
            min={0}
            max={durationFrames}
            step={1}
            defaultValue={which === 'a' ? 0 : durationFrames}
            aria-label={which === 'a' ? 'จุดเริ่มคลิป' : 'จุดจบคลิป'}
            data-testid={which === 'a' ? 'trim-start' : 'trim-end'}
            className="trim-handle pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent"
            onInput={() => clampAndPaint(which)}
            onPointerUp={commit}
            onKeyUp={(e) => {
              if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') commit();
            }}
          />
        ))}
      </div>
    </div>
  );
}
