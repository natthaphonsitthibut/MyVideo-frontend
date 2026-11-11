import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { StatusPage } from './StatusPage';

function renderPage() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StatusPage', () => {
  it('shows every check up when /health is ok', async () => {
    stubFetch(200, {
      status: 'ok',
      checks: { postgres: { status: 'up', latencyMs: 3 }, redis: { status: 'up', latencyMs: 1 } },
    });
    renderPage();
    expect(await screen.findByText('ทุกอย่างปกติ')).toBeTruthy();
    expect(screen.getByTestId('check-postgres').dataset.status).toBe('up');
    expect(screen.getByTestId('check-redis').dataset.status).toBe('up');
    const request = vi.mocked(fetch).mock.calls[0]?.[0] as Request | undefined;
    expect(request?.url).toMatch(/\/api\/health$/);
  });

  it('treats a 503 health report as data and names the failing dependency', async () => {
    stubFetch(503, {
      status: 'degraded',
      checks: {
        postgres: { status: 'up', latencyMs: 3 },
        redis: { status: 'down', latencyMs: 2, error: 'Connection is closed.' },
      },
    });
    renderPage();
    expect(await screen.findByText('บางส่วนมีปัญหา')).toBeTruthy();
    expect(screen.getByTestId('check-redis').dataset.status).toBe('down');
    expect(screen.getByText('Connection is closed.')).toBeTruthy();
  });

  it('says the server is unreachable when the API fails', async () => {
    stubFetch(502, 'Bad Gateway');
    renderPage();
    expect(await screen.findByText('ติดต่อเซิร์ฟเวอร์ไม่ได้')).toBeTruthy();
  });
});
