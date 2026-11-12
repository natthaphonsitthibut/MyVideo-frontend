import { layoutLines, type Measure } from '@myvideo/stage';
import type { Command } from '@myvideo/timeline-core';

/**
 * Caption look and height for the whole clip (E08-F05): one command sets every caption page's look and vertical
 * position and lays its lines out again with that look's font (sizes differ per look, so stored lines must follow).
 * Positions are canvas px from the centre; the stage clamps them into the platform safe area.
 */
export const CAPTION_POSITIONS = { top: -420, middle: 120, bottom: 560 } as const;

export const CAPTION_LOOKS: { id: string; name: string }[] = [
  { id: 'pop-word', name: 'เด้งทีละคำ' },
  { id: 'outline-bold', name: 'ขอบหนา' },
  { id: 'boxed', name: 'ในกล่อง' },
  { id: 'bold-highlight', name: 'ตัวหนา เน้นสี' },
  { id: 'clean', name: 'เรียบ' },
  { id: 'minimal', name: 'บาง' },
];

type Caption = {
  type: 'caption';
  styleRef: string;
  transform: { x: number; y: number; scale: number; rotation: number };
  words: { text: string; startFrame: number; endFrame: number }[];
  lines: number[][];
};

export function restyleCaptions(
  next: { styleRef: string; y: number },
  /** Measure + line width for a look (its own font; fonts must be loaded by the caller). */
  layoutFor: (styleRef: string) => { measure: Measure; maxWidth: number },
): Command {
  return {
    label: 'caption look',
    apply(draft) {
      for (const el of Object.values(draft.elements) as unknown as Caption[]) {
        if (el.type !== 'caption') continue;
        const { measure, maxWidth } = layoutFor(next.styleRef);
        el.styleRef = next.styleRef;
        el.transform = { ...el.transform, y: next.y };
        el.lines = layoutLines(el.words, measure, maxWidth);
      }
    },
  };
}
