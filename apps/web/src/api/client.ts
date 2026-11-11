import createClient from 'openapi-fetch';
import type { components, paths } from './generated/schema';

/** Typed API client generated from backend/openapi.json (`pnpm gen:api`). Same-origin `/api` (Vite proxy in dev). */
export const api = createClient<paths>({
  baseUrl: `${globalThis.location?.origin ?? ''}/api`,
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
