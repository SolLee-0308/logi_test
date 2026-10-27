import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'
import { AuthContext, type AuthContextValue } from '@/lib/auth-context'
import type { Profile } from '@/lib/types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['auth-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as Profile | null
    },
  })

  const value: AuthContextValue = {
    session,
    profile: profileQuery.data ?? null,
    isLoading: sessionLoading || (Boolean(userId) && profileQuery.isPending),
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signOut: async () => {
      await supabase!.auth.signOut()
      queryClient.clear()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
