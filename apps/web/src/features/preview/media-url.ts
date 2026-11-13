import type { StageAsset } from '@myvideo/stage';
import { API_BASE_URL } from '@/api/client';

/**
 * URL of a project asset's file: a product library sound (same for everyone) or a merchant source file
 * (`proxy` for preview — never play originals in the browser — `original` for the parity harness).
 */
export function mediaUrl(asset: StageAsset, kind: 'proxy' | 'original' = 'proxy'): string {
  if (asset.brandLogo) return `${API_BASE_URL}/brand-kit/logo`;
  if (asset.musicId) return `${API_BASE_URL}/music/${asset.musicId}/file`;
  if (asset.libraryId) return `${API_BASE_URL}/library/sounds/${encodeURIComponent(asset.libraryId)}`;
  return `${API_BASE_URL}/sources/${asset.sourceId}/assets/${kind}`;
}
