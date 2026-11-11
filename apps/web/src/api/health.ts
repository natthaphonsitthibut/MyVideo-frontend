import { useQuery } from '@tanstack/react-query';
import { ApiError, api, type Schemas } from './client';

export type HealthReport = Schemas['HealthReport'];
export type CheckStatus = Schemas['CheckStatus'];

/** `/health` answers 503 with a full report when a dependency is down — that is data, not an error. */
async function fetchHealth(): Promise<HealthReport> {
  const { data, error, response } = await api.GET('/health');
  if (data) return data;
  if (response.status === 503 && error) return error;
  throw new ApiError(response.status, error);
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 10_000 });
}
