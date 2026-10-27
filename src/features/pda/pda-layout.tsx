import { Link, Outlet, useLocation } from 'react-router'
import { ChevronLeft, LogOut, ScanBarcode } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'

// PDA 전용 레이아웃: 사이드바 없이 한 손 조작에 맞춘 세로 화면
export function PdaLayout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const isHome = pathname === '/pda'

  return (
    <div className="bg-muted/30 flex min-h-svh flex-col">
      <header className="bg-primary text-primary-foreground sticky top-0 z-10 flex h-14 items-center gap-2 px-3">
        {isHome ? (
          <ScanBarcode className="size-5" />
        ) : (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hover:bg-primary-foreground/10 text-primary-foreground"
          >
            <Link to="/pda" aria-label="PDA 홈">
              <ChevronLeft className="size-6" />
            </Link>
          </Button>
        )}
        <span className="flex-1 truncate text-base font-semibold">LOGI PDA</span>
        <span className="truncate text-sm opacity-80">{profile?.user_name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary-foreground/10 text-primary-foreground"
          onClick={signOut}
          aria-label="로그아웃"
        >
          <LogOut className="size-5" />
        </Button>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 p-3">
        <Outlet />
      </main>
    </div>
  )
}
