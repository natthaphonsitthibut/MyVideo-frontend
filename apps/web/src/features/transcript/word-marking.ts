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
