/** Same-origin API base. Dev: Vite proxies `/api` to the NestJS API (vite.config.ts). */
export const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
    this.name = 'ApiError';
  }
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', ...init });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
