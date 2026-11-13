const isThai = (ch: string | undefined) => !!ch && ch >= '฀' && ch <= '๿';

/**
 * Whether a gap goes after word `i`. Thai is written without spaces, so two Thai pieces read as one word (ไลฟ์สด,
 * not ไลฟ์ สด); a gap stays next to Latin/numbers and around a removed (struck-through) word.
 */
export function gapAfter(
  words: readonly { text: string; deleted?: boolean; mergedInto?: number | null }[],
  i: number,
): boolean {
  const w = words[i];
  let j = i + 1;
  while (words[j] && words[j]?.mergedInto != null) j++;
  const next = words[j];
  if (!w || !next) return false;
  if (w.deleted || next.deleted) return true;
  return !(isThai(w.text.at(-1)) && isThai(next.text[0]));
}

/** Optional new fields keep cached responses from before the API update readable. */
export function wordMarking(word: { original: string | null; aiFixed?: boolean; heard?: string | null }) {
  const edited = word.original !== null;
  const ai = !edited && word.aiFixed === true;
  const heard = word.heard ?? word.original;
  return {
    ai,
    edited,
    heard,
    title: ai && heard !== null ? `AI แก้จาก “${heard}”` : edited ? `เดิม: ${heard}` : undefined,
    canRevert: (ai || edited) && heard !== null,
  };
}
