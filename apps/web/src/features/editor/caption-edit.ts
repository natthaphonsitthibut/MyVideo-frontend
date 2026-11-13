import { layoutLines, type Measure } from '@myvideo/stage';
import type { Command } from '@myvideo/timeline-core';

/**
 * Caption text editing (E08-F04), pure: a word keeps its audio timing; the page's lines are laid out again with
 * the stage's own measure so the stored lines never overflow (the browser never re-wraps captions).
 */
type Word = {
  text: string;
  startFrame: number;
  endFrame: number;
  origin?: 'ai';
  asrText?: string;
  emphasis?: true;
};
type Caption = { id: string; type: 'caption'; startFrame: number; words: Word[]; lines: number[][] };
export type Layout = { measure: Measure; maxWidth: number; maxLines: number };

export function captionRows(elements: Record<string, { type: string } & Partial<Caption>>) {
  return Object.values(elements)
    .filter((e): e is Caption => e.type === 'caption')
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((c) => ({
      id: c.id,
      startFrame: c.startFrame,
      words: c.words.map((w) => ({
        text: w.text,
        ai: w.origin === 'ai',
        heard: w.origin === 'ai' ? (w.asrText ?? null) : null,
      })),
    }));
}

/** The word without its AI provenance (the merchant decided). */
function plain(w: Word, text: string): Word {
  const { origin: _o, asrText: _a, ...rest } = w;
  return { ...rest, text };
}

/** Lines for the edited page; a longer text may need more lines than the style's usual count — never hide words. */
function relayout(words: Word[], layout: Layout): number[][] {
  return layoutLines(words, layout.measure, layout.maxWidth);
}

export function editCaptionWord(c: Caption, index: number, text: string, layout: Layout) {
  const t = text.normalize('NFC').trim();
  if (!t) throw new Error('caption word cannot be empty');
  const words = c.words.map((w, i) => (i === index ? plain(w, t) : w));
  return { words, lines: relayout(words, layout) };
}

/**
 * Removes a word (user request 2026-11-13). Its time goes to the word before it (the first word's time goes to the
 * next), so every other word stays on its audio. A page's only word is not removed here: remove the page instead.
 */
export function removeCaptionWord(c: Caption, index: number, layout: Layout) {
  if (c.words.length < 2) throw new Error('the only word of a caption page: remove the page instead');
  const gone = c.words[index];
  if (!gone) throw new Error(`no word ${index}`);
  const words = c.words.filter((_, i) => i !== index);
  if (index > 0) {
    const prev = words[index - 1] as Word;
    words[index - 1] = { ...prev, endFrame: gone.endFrame };
  } else {
    const next = words[0] as Word;
    words[0] = { ...next, startFrame: gone.startFrame };
  }
  return { words, lines: relayout(words, layout) };
}

/** A line break inside the page before word `index`: both parts are laid out within the width as usual. */
export function breakCaptionLineAt(c: Caption, index: number, layout: Layout) {
  if (index <= 0 || index >= c.words.length) throw new Error('a line break needs words on both sides');
  const head = relayout(c.words.slice(0, index), layout);
  const tail = relayout(c.words.slice(index), layout).map((line) => line.map((i) => i + index));
  return { words: c.words, lines: [...head, ...tail] };
}

export function revertCaptionWord(c: Caption, index: number, layout: Layout) {
  const w = c.words[index];
  if (!w?.asrText) return { words: c.words, lines: c.lines };
  return editCaptionWord(c, index, w.asrText, layout);
}

type PageDraft = {
  elements: Record<string, (Caption & { durationFrames: number; trackId?: string }) | undefined>;
  tracks: { id: string; kind: string; elementIds: string[] }[];
};

/** One page with the next one (every word keeps its audio time; the page covers both). */
export function mergeCaptionWithNext(id: string, nextId: string, layout: Layout): Command {
  return {
    label: 'merge captions',
    apply(raw) {
      const d = raw as unknown as PageDraft;
      const a = d.elements[id];
      const b = d.elements[nextId];
      if (!a || !b || a.type !== 'caption' || b.type !== 'caption') throw new Error('not two captions');
      const shift = b.startFrame - a.startFrame;
      a.words = [
        ...a.words,
        ...b.words.map((w) => ({ ...w, startFrame: w.startFrame + shift, endFrame: w.endFrame + shift })),
      ];
      a.durationFrames = shift + b.durationFrames;
      a.lines = relayout(a.words, layout);
      delete d.elements[nextId];
      for (const t of d.tracks) t.elementIds = t.elementIds.filter((x) => x !== nextId);
    },
  };
}

/** A new page starting at word `index` (the first page ends with the previous word). */
export function splitCaptionAt(id: string, index: number, newId: string, layout: Layout): Command {
  return {
    label: 'split caption',
    apply(raw) {
      const d = raw as unknown as PageDraft;
      const c = d.elements[id];
      if (c?.type !== 'caption') throw new Error(`caption ${id} not found`);
      const at = c.words[index];
      const last = c.words[index - 1];
      if (index <= 0 || !at || !last) throw new Error('split needs words on both sides');
      const cut = at.startFrame;
      const head = c.words.slice(0, index);
      const tail = c.words
        .slice(index)
        .map((w) => ({ ...w, startFrame: w.startFrame - cut, endFrame: w.endFrame - cut }));
      d.elements[newId] = {
        ...structuredClone(c),
        id: newId,
        startFrame: c.startFrame + cut,
        durationFrames: c.durationFrames - cut,
        words: tail,
        lines: relayout(tail, layout),
      };
      c.words = head;
      c.durationFrames = last.endFrame;
      c.lines = relayout(head, layout);
      for (const t of d.tracks) {
        const i = t.elementIds.indexOf(id);
        if (i >= 0) t.elementIds.splice(i + 1, 0, newId);
      }
    },
  };
}

export function acceptCaptionWord(c: Caption, index: number) {
  const words = c.words.map((w, i) => (i === index ? plain(w, w.text) : w));
  return { words, lines: c.lines };
}
