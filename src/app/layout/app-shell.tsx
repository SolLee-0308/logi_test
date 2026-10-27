import { Outlet, useLocation } from 'react-router'

import { findNavItem, navGroups } from '@/app/navigation'
import { AppSidebar } from '@/app/layout/app-sidebar'
import { CommandMenu } from '@/app/layout/command-menu'
import { ThemeToggle } from '@/app/layout/theme-toggle'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export function AppShell() {
  const { pathname } = useLocation()
  const current = findNavItem(pathname)
  const group = current && navGroups.find((g) => g.items.includes(current))

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              {group && (
                <>
                  <BreadcrumbItem className="text-muted-foreground">{group.label}</BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{current?.title ?? '페이지 없음'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <CommandMenu />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
