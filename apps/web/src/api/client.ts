import createClient from 'openapi-fetch';
import type { components, paths } from './generated/schema';

/** Typed API client generated from backend/openapi.json (`pnpm gen:api`). Same-origin `/api` (Vite proxy in dev). */
export const API_BASE_URL = `${globalThis.location?.origin ?? ''}/api`;

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'same-origin',
  // Late-bound so tests can stub `fetch`.
  fetch: (request) => globalThis.fetch(request),
});

export type Schemas = components['schemas'];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
    this.name = 'ApiError';
  }
}

/** The server's Thai message for a refused request, or a generic one. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string } | null;
    if (body?.message) return body.message;
  }
  return 'ทำไม่สำเร็จ ลองอีกครั้ง';
}
