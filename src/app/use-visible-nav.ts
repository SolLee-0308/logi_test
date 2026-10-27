import { useMemo } from 'react'

import { navGroups, type NavGroup } from '@/app/navigation'
import { hasRole, useAuth } from '@/lib/auth-context'

// 로그인 사용자 권한으로 볼 수 있는 메뉴만 반환
export function useVisibleNavGroups(): NavGroup[] {
  const { profile } = useAuth()
  return useMemo(
    () =>
      navGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => hasRole(profile, i.roles)) }))
        .filter((g) => g.items.length > 0),
    [profile],
  )
}
