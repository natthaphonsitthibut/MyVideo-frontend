import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/app/query-client';
import { LoginPage, safeNext } from './LoginPage';

function setup(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    ),
  );
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/clips', element: <p>clips page</p> },
    ],
    { initialEntries: ['/login?next=%2Fclips'] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'owner@demo.local' } });
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret-pass' } });
  fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('shows a Thai error on wrong credentials and stays on the page', async () => {
    setup(401, { statusCode: 401, error: 'unauthorized', message: 'Wrong email or password' });
    expect((await screen.findByRole('alert')).textContent).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect((screen.getByRole('button', { name: 'เข้าสู่ระบบ' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('goes to the `next` page after signing in', async () => {
    setup(200, {
      user: { id: '0', email: 'owner@demo.local', displayName: 'x', role: 'owner' },
      merchant: { id: '0', name: 'ร้าน', slug: 'demo-shop' },
    });
    expect(await screen.findByText('clips page')).toBeTruthy();
    const req = vi.mocked(fetch).mock.calls[0]?.[0] as Request;
    expect(req.method).toBe('POST');
    expect(await req.json()).toEqual({ email: 'owner@demo.local', password: 'secret-pass' });
  });
});

describe('safeNext', () => {
  it('allows only in-app paths', () => {
    expect(safeNext('/clips?x=1')).toBe('/clips?x=1');
    expect(safeNext('//evil.example')).toBe('/projects');
    expect(safeNext('https://evil.example')).toBe('/projects');
    expect(safeNext(null)).toBe('/projects');
  });
});
