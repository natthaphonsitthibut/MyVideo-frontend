import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { PlanPanel } from './PlanPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('submits multiple styles together, preserves the primary choice and prevents an empty edit', async () => {
  const client = createQueryClient();
  const plan = {
    runId: 'run',
    styleId: null,
    lockedStyle: null,
    steps: [],
    done: 0,
    total: 5,
    finished: false,
    failed: false,
    needs: 'style',
    proposals: ['simple', 'premium', 'sale-fast'].map((styleId) => ({
      styleId,
      name: styleId,
      description: '',
      reason: null,
      origin: 'catalogue',
    })),
  };
  client.setQueryData(['folders', 'folder', 'plan'], plan);
  const requests: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      if (request.method === 'POST') requests.push(await request.json());
      return new Response(JSON.stringify(plan), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  render(
    <QueryClientProvider client={client}>
      <PlanPanel folderId="folder" sourceIds={['source']} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'premium' }));
  fireEvent.click(screen.getByRole('button', { name: 'ตัดต่อ 2 สไตล์' }));
  await waitFor(() =>
    expect(requests).toEqual([{ styleId: 'simple', styleIds: ['simple', 'premium'], lockStyle: false }]),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'ตัดต่อ 2 สไตล์' }).hasAttribute('disabled')).toBe(false),
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'simple' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'premium' }));
  expect(screen.getByRole('button', { name: 'ตัดต่อ 0 สไตล์' }).hasAttribute('disabled')).toBe(true);
  client.clear();
});
