import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './shell/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { ActivationPage } from '@/features/activation/ActivationPage'
import { TrackPage } from '@/features/tracking/TrackPage'
import { AdminLayout } from '@/features/admin/AdminLayout'

/**
 * Arabic-only v1 (D3), but routes stay under /ar/* so a future /en locale is a
 * prefix rather than a rewrite. Bare paths redirect rather than 404 so old
 * links and shared URLs keep working.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/ar/activation', element: <ActivationPage /> },
      { path: '/ar/track', element: <TrackPage /> },
      { path: '/activation', element: <Navigate to="/ar/activation" replace /> },
      { path: '/track', element: <Navigate to="/ar/track" replace /> },
      { path: '/admin', element: <AdminLayout /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])