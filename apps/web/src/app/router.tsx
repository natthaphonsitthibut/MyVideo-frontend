import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { LoginPage } from '@/auth/LoginPage';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell, PageFallback } from './AppShell';
import { RouteError } from './RouteError';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageFallback />,
    children: [
      { index: true, element: <Navigate to="/library" replace /> },
      {
        path: 'library',
        lazy: () => import('@/pages/LibraryPage').then((m) => ({ Component: m.LibraryPage })),
      },
      {
        path: 'library/:id',
        lazy: () => import('@/pages/SourcePage').then((m) => ({ Component: m.SourcePage })),
      },
      { path: 'clips', lazy: () => import('@/pages/ClipsPage').then((m) => ({ Component: m.ClipsPage })) },
      {
        path: 'exports',
        lazy: () => import('@/pages/ExportsPage').then((m) => ({ Component: m.ExportsPage })),
      },
      { path: 'jobs', lazy: () => import('@/pages/JobsPage').then((m) => ({ Component: m.JobsPage })) },
      { path: 'status', lazy: () => import('@/pages/StatusPage').then((m) => ({ Component: m.StatusPage })) },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
