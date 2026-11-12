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
        // diagnostics, not product pages (D-037): queue test runs and service health
        path: '/dev',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: 'jobs', lazy: () => import('@/pages/JobsPage').then((m) => ({ Component: m.JobsPage })) },
          {
            path: 'status',
            lazy: () => import('@/pages/StatusPage').then((m) => ({ Component: m.StatusPage })),
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
      { index: true, element: <Navigate to="/projects" replace /> },
      {
        path: 'projects',
        lazy: () => import('@/pages/ProjectsPage').then((m) => ({ Component: m.ProjectsPage })),
      },
      {
        path: 'projects/:id',
        lazy: () => import('@/pages/ProjectFolderPage').then((m) => ({ Component: m.ProjectFolderPage })),
      },
      {
        path: 'library',
        lazy: () => import('@/pages/LibraryPage').then((m) => ({ Component: m.LibraryPage })),
      },
      {
        path: 'library/:id',
        lazy: () => import('@/pages/SourcePage').then((m) => ({ Component: m.SourcePage })),
      },
      // pages removed in the two-page app (D-037): old links land on the projects list
      ...['review-video', 'exports', 'brand', 'jobs', 'status'].map((path) => ({
        path,
        element: <Navigate to="/projects" replace />,
      })),
      {
        path: 'timings',
        lazy: () => import('@/pages/TimingsPage').then((m) => ({ Component: m.TimingsPage })),
      },
      {
        path: 'clips',
        lazy: () => import('@/pages/EditedClipsPage').then((m) => ({ Component: m.EditedClipsPage })),
      },
      {
        path: 'clips/:id',
        lazy: () => import('@/pages/ClipPage').then((m) => ({ Component: m.ClipPage })),
      },
      {
        path: 'clips/:id/edit',
        lazy: () => import('@/pages/QuickEditPage').then((m) => ({ Component: m.QuickEditPage })),
      },
      {
        path: 'clips/:id/advanced',
        lazy: () => import('@/pages/AdvancedEditorPage').then((m) => ({ Component: m.AdvancedEditorPage })),
      },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
