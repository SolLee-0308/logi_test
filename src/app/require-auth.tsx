import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Loader2, ServerCog, ShieldAlert } from 'lucide-react'

import { hasRole, useAuth } from '@/lib/auth-context'
import { isSupabaseConfigured } from '@/lib/supabase'
import type { Role } from '@/lib/types'
import { Button } from '@/components/ui/button'

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      {children}
    </div>
  )
}

// 로그인 + 활성 프로필 확인. 미로그인은 /login 으로 보낸다.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, isLoading, signOut } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return (
      <Centered>
        <ServerCog className="text-muted-foreground size-10" />
        <h1 className="text-xl font-semibold">Supabase 연결 설정이 필요합니다</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          프로젝트 루트의 <code>.env.example</code>을 <code>.env.local</code>로 복사한 뒤
          VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 입력하고 개발 서버를 다시 시작하세요.
        </p>
      </Centered>
    )
  }
  if (isLoading) {
    return (
      <Centered>
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </Centered>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile || !profile.is_active) {
    return (
      <Centered>
        <ShieldAlert className="text-muted-foreground size-10" />
        <h1 className="text-xl font-semibold">사용 권한이 없는 계정입니다</h1>
        <p className="text-muted-foreground text-sm">
          사용자 정보가 없거나 미사용 상태입니다. 관리자에게 문의하세요.
        </p>
        <Button variant="outline" onClick={signOut}>
          로그아웃
        </Button>
      </Centered>
    )
  }
  return children
}

// 역할별 화면 접근 제한
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { profile } = useAuth()
  if (!hasRole(profile, roles)) {
    return (
      <Centered>
        <ShieldAlert className="text-muted-foreground size-10" />
        <h1 className="text-xl font-semibold">접근 권한이 없습니다</h1>
      </Centered>
    )
  }
  return children
}
