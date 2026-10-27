import { CalendarClock, CheckCircle2, ClipboardCheck, Truck } from 'lucide-react'

import { SupabaseStatusCard } from '@/features/dashboard/supabase-status-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// 실제 수치는 입고 프로세스 정의 후 연결한다.
const kpis = [
  { title: '오늘 입고예정', icon: CalendarClock },
  { title: '도착 대기', icon: Truck },
  { title: '검수 중', icon: ClipboardCheck },
  { title: '오늘 입고완료', icon: CheckCircle2 },
]

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground">입고 현황을 한눈에 확인합니다.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardDescription>{kpi.title}</CardDescription>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">—</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>오늘 도착 예정</CardTitle>
            <CardDescription>입고예정 기능 구현 후 표시됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            데이터 없음
          </CardContent>
        </Card>
        <SupabaseStatusCard />
      </div>
    </div>
  )
}
