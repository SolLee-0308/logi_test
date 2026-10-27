import { useQuery } from '@tanstack/react-query'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Auth 헬스 엔드포인트로 Supabase 접속 여부만 확인한다(테이블 없이도 동작).
async function checkConnection() {
  const { error } = await supabase!.auth.getSession()
  if (error) throw error
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return true
}

export function SupabaseStatusCard() {
  const { isPending, isError, error } = useQuery({
    queryKey: ['supabase-health'],
    queryFn: checkConnection,
    enabled: isSupabaseConfigured,
  })

  let badge = <Badge variant="secondary">미설정</Badge>
  let message = '.env.local에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요.'
  if (isSupabaseConfigured) {
    if (isPending) {
      badge = <Badge variant="secondary">확인 중</Badge>
      message = '연결을 확인하고 있습니다.'
    } else if (isError) {
      badge = <Badge variant="destructive">연결 실패</Badge>
      message = error.message
    } else {
      badge = <Badge>연결됨</Badge>
      message = import.meta.env.VITE_SUPABASE_URL
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>시스템 상태</CardTitle>
          <CardDescription>Supabase 연결</CardDescription>
        </div>
        {badge}
      </CardHeader>
      <CardContent>
        <p className="text-sm break-all text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
