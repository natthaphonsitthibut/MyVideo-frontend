import { useQuery } from '@tanstack/react-query';
import { ApiError, getJson } from './http';

export type CheckStatus = { status: 'up' | 'down'; latencyMs: number; error?: string };
export type HealthReport = { status: 'ok' | 'degraded'; checks: Record<string, CheckStatus> };

/** `/health` answers 503 with a full report when a dependency is down — that is data, not an error. */
async function fetchHealth(): Promise<HealthReport> {
  try {
    return await getJson<HealthReport>('/health');
  } catch (err) {
    if (err instanceof ApiError && err.status === 503 && err.body) return err.body as HealthReport;
    throw err;
  }
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 10_000 });
}
