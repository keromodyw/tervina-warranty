import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './shell/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { ActivationWizard } from '@/features/activation/ActivationWizard'
import { TrackPage } from '@/features/tracking/TrackPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { AdminOrders } from '@/features/admin/AdminOrders'
import { AdminDashboard } from '@/features/admin/AdminDashboard'
import { AdminSettings } from '@/features/admin/AdminSettings'
import { AdminStaff } from '@/features/admin/AdminStaff'

// Vite sets BASE_URL to the configured `base`. On the real deploy this is "/",
// but a GitHub Pages project site is served from "/repo/", so the router must
// agree with the asset base or every route 404s. Strip the trailing slash
// because React Router treats "/repo/" and "/repo" differently from "/".
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

/**
 * Arabic-only v1 (D3), but routes stay under /ar/* so a future /en locale is a
 * prefix rather than a rewrite. The landing (dual action) is /ar/activation and
 * the wizard is /ar/activation/new, matching PROJECT_MAP [SYSTEM_FLOW]; bare and
 * legacy paths redirect rather than 404 so shared links keep working.
 */
export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <Navigate to="/ar/activation" replace /> },
        { path: '/ar/activation', element: <HomePage /> },
        { path: '/ar/activation/new', element: <ActivationWizard /> },
        { path: '/ar/activation/track', element: <TrackPage /> },
        { path: '/activation', element: <Navigate to="/ar/activation" replace /> },
        { path: '/activation/new', element: <Navigate to="/ar/activation/new" replace /> },
        { path: '/activation/track', element: <Navigate to="/ar/activation/track" replace /> },
        { path: '/ar/track', element: <Navigate to="/ar/activation/track" replace /> },
        { path: '/track', element: <Navigate to="/ar/activation/track" replace /> },
        {
          path: '/admin',
          element: <AdminLayout />,
          children: [
            { index: true, element: <Navigate to="/admin/orders" replace /> },
            { path: 'orders', element: <AdminOrders /> },
            { path: 'dashboard', element: <AdminDashboard /> },
            { path: 'settings', element: <AdminSettings /> },
        { path: 'staff', element: <AdminStaff /> },
          ],
        },
        { path: '*', element: <Navigate to="/ar/activation" replace /> },
      ],
    },
  ],
  { basename },
)
