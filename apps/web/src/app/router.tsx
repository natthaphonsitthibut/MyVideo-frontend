import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/library" replace /> },
      {
        path: 'library',
        lazy: () => import('@/pages/LibraryPage').then((m) => ({ Component: m.LibraryPage })),
      },
      { path: 'clips', lazy: () => import('@/pages/ClipsPage').then((m) => ({ Component: m.ClipsPage })) },
      {
        path: 'exports',
        lazy: () => import('@/pages/ExportsPage').then((m) => ({ Component: m.ExportsPage })),
      },
      { path: 'status', lazy: () => import('@/pages/StatusPage').then((m) => ({ Component: m.StatusPage })) },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
