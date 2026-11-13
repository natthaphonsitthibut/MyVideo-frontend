export type OutputRatio = '9:16' | '16:9' | '1:1';

/**
 * "Auto" output frame = the majority orientation of the footage (videos and photos alike). Ties and an empty
 * folder go to 9:16, the frame of the short-video platforms merchants post to.
 */
export function autoRatio(footage: readonly { width: number | null; height: number | null }[]): OutputRatio {
  const count = { '9:16': 0, '16:9': 0, '1:1': 0 } satisfies Record<OutputRatio, number>;
  for (const f of footage) {
    if (!f.width || !f.height) continue;
    const r = f.width / f.height;
    if (Math.abs(r - 1) <= 0.05) count['1:1']++;
    else if (r < 1) count['9:16']++;
    else count['16:9']++;
  }
  const order: OutputRatio[] = ['9:16', '16:9', '1:1'];
  return order.reduce((best, k) => (count[k] > count[best] ? k : best), '9:16');
}
