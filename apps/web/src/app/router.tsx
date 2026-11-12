import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router';
import { LoginPage } from '@/auth/LoginPage';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell, PageFallback } from './AppShell';
import { RouteError } from './RouteError';

/** Dev-only pages (tests and debugging); never in a production build. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/components',
        lazy: () => import('@/pages/dev/ComponentsPage').then((m) => ({ Component: m.ComponentsPage })),
      },
      {
        path: '/dev/stage/:id',
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            index: true,
            lazy: () => import('@/pages/dev/StageHarness').then((m) => ({ Component: m.StageHarness })),
          },
        ],
      },
      {
        path: '/dev/player/:id',
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            index: true,
            lazy: () => import('@/pages/dev/PlayerHarness').then((m) => ({ Component: m.PlayerHarness })),
          },
        ],
      },
    ]
  : [];

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  ...devRoutes,
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
        path: 'clips/:id',
        lazy: () => import('@/pages/ClipPage').then((m) => ({ Component: m.ClipPage })),
      },
      {
        path: 'clips/:id/edit',
        lazy: () => import('@/pages/QuickEditPage').then((m) => ({ Component: m.QuickEditPage })),
      },
      {
        path: 'exports',
        lazy: () => import('@/pages/ExportsPage').then((m) => ({ Component: m.ExportsPage })),
      },
      {
        path: 'review-video',
        lazy: () => import('@/pages/ReviewVideoPage').then((m) => ({ Component: m.ReviewVideoPage })),
      },
      { path: 'brand', lazy: () => import('@/pages/BrandPage').then((m) => ({ Component: m.BrandPage })) },
      { path: 'jobs', lazy: () => import('@/pages/JobsPage').then((m) => ({ Component: m.JobsPage })) },
      { path: 'status', lazy: () => import('@/pages/StatusPage').then((m) => ({ Component: m.StatusPage })) },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
