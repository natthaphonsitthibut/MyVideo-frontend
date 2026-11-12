import type { ReviewShot, ReviewVideoState, ShotRole } from '@/api/review-videos';

export type ReviewStep = 'analysing' | 'ready' | 'missing' | 'failed';

/** Where the merchant is in a review video run. */
export function reviewStep(s: ReviewVideoState | undefined): ReviewStep {
  if (!s) return 'analysing';
  if (s.status === 'failed' || s.status === 'cancelled') return 'failed';
  if (s.result?.status === 'ready' && s.result.projectId) return 'ready';
  if (s.result?.status === 'missing') return 'missing';
  return 'analysing';
}

export const shotKey = (s: Pick<ReviewShot, 'sourceId' | 'seq'>) => `${s.sourceId}:${s.seq}`;

/**
 * Roles to send with a retry: what the merchant changed, plus the shots they already confirmed before; shots the
 * classifier was sure about and the merchant left alone stay automatic.
 */
export function chosenRoles(
  shots: readonly ReviewShot[],
  picked: Readonly<Record<string, ShotRole>>,
): Record<string, ShotRole> {
  const out: Record<string, ShotRole> = {};
  for (const s of shots) {
    const key = shotKey(s);
    const p = picked[key];
    if (p && p !== s.role) out[key] = p;
    else if (s.chosenByMerchant) out[key] = s.role;
  }
  return out;
}

/** Product points as typed: one per line, trimmed, empty lines dropped, at most 4. */
export function parsePoints(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.normalize('NFC').trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 4);
}
