import { createBrowserRouter } from 'react-router'

import { AppShell } from '@/app/layout/app-shell'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { PlaceholderPage } from '@/features/placeholder/placeholder-page'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: '*', element: <PlaceholderPage /> },
    ],
  },
])
