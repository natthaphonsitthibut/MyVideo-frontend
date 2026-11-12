import { layoutLines, type Measure } from '@myvideo/stage';

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

export function revertCaptionWord(c: Caption, index: number, layout: Layout) {
  const w = c.words[index];
  if (!w?.asrText) return { words: c.words, lines: c.lines };
  return editCaptionWord(c, index, w.asrText, layout);
}

export function acceptCaptionWord(c: Caption, index: number) {
  const words = c.words.map((w, i) => (i === index ? plain(w, w.text) : w));
  return { words, lines: c.lines };
}
