import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './shell/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { ActivationPage } from '@/features/activation/ActivationPage'
import { TrackPage } from '@/features/tracking/TrackPage'
import { AdminLayout } from '@/features/admin/AdminLayout'

// Vite sets BASE_URL to the configured `base`. On the real deploy this is "/",
// but a GitHub Pages project site is served from "/repo/", so the router must
// agree with the asset base or every route 404s. Strip the trailing slash
// because React Router treats "/repo/" and "/repo" differently from "/".
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

/**
 * Arabic-only v1 (D3), but routes stay under /ar/* so a future /en locale is a
 * prefix rather than a rewrite. Bare paths redirect rather than 404 so old
 * links and shared URLs keep working.
 */
export const router = createBrowserRouter(
  [
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
  ],
  { basename },
)