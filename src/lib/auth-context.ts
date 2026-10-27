import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

import type { Profile, Role } from '@/lib/types'

export type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function hasRole(profile: Profile | null, roles?: Role[]) {
  if (!roles) return true
  return Boolean(profile && roles.includes(profile.role))
}

export function isShipperUser(profile: Profile | null) {
  return profile?.user_type === 'SHIPPER'
}

// 3PL 승인 권한 (DB can_approve 와 동일)
export function canApprove(profile: Profile | null) {
  return (
    profile?.user_type === 'INTERNAL' && (profile.role === 'ADMIN' || profile.role === 'OPERATOR')
  )
}
