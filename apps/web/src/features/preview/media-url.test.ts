import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@/api/client';
import { mediaUrl } from './media-url';

describe('mediaUrl', () => {
  it('maps a library sound to the library route and a source to its proxy / original', () => {
    const base = { kind: 'audio' as const, durationFrames: 7, hasAudio: true };
    expect(mediaUrl({ ...base, libraryId: 'whoosh-fast-soft' })).toBe(
      `${API_BASE_URL}/library/sounds/whoosh-fast-soft`,
    );
    expect(mediaUrl({ ...base, kind: 'video', sourceId: 'abc' })).toBe(
      `${API_BASE_URL}/sources/abc/assets/proxy`,
    );
    expect(mediaUrl({ ...base, kind: 'video', sourceId: 'abc' }, 'original')).toBe(
      `${API_BASE_URL}/sources/abc/assets/original`,
    );
  });
});
