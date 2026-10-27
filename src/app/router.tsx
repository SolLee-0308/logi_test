import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'

import { AppShell } from '@/app/layout/app-shell'
import { allNavItems } from '@/app/navigation'
import { RequireAuth, RequireRole } from '@/app/require-auth'
import { LoginPage } from '@/features/auth/login-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { PlaceholderPage } from '@/features/placeholder/placeholder-page'

// 메뉴의 roles 설정을 그대로 화면 접근 제한에 사용하고, 화면은 필요할 때 불러온다.
function page(path: string, load: () => Promise<ComponentType>): RouteObject {
  const roles = allNavItems.find((i) => i.url === `/${path}`)?.roles
  return {
    path,
    lazy: async () => {
      const Page = await load()
      return {
        element: (
          <RequireRole roles={roles}>
            <Page />
          </RequireRole>
        ),
      }
    },
  }
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      page('master/company', () =>
        import('@/features/master/company-page').then((m) => m.CompanyPage),
      ),
      page('master/shippers', () =>
        import('@/features/master/shippers-page').then((m) => m.ShippersPage),
      ),
      page('master/center', () =>
        import('@/features/master/center-page').then((m) => m.CenterPage),
      ),
      page('master/items', () => import('@/features/master/items-page').then((m) => m.ItemsPage)),
      page('master/vehicles', () =>
        import('@/features/master/vehicles-page').then((m) => m.VehiclesPage),
      ),
      page('master/codes', () => import('@/features/master/codes-page').then((m) => m.CodesPage)),
      page('inbound/plans', () => import('@/features/inbound/plans-page').then((m) => m.PlansPage)),
      page('inbound/plans/new', () =>
        import('@/features/inbound/plan-form-page').then((m) => m.PlanFormPage),
      ),
      page('inbound/plans/:id', () =>
        import('@/features/inbound/plan-detail-page').then((m) => m.PlanDetailPage),
      ),
      page('inbound/plans/:id/edit', () =>
        import('@/features/inbound/plan-form-page').then((m) => m.PlanFormPage),
      ),
      page('admin/users', () => import('@/features/admin/users-page').then((m) => m.UsersPage)),
      { path: '*', element: <PlaceholderPage /> },
    ],
  },
])
