import { useNavigate } from 'react-router'
import { CalendarClock, CheckCircle2, ClipboardList, PackageCheck } from 'lucide-react'

import { isShipperUser, useAuth } from '@/lib/auth-context'
import { todayKst, formatQty } from '@/lib/date'
import { usePendingCounts, usePlans } from '@/features/inbound/api'
import { KpiCard } from '@/features/dashboard/kpi-card'
import { ShipperDashboard } from '@/features/dashboard/shipper-dashboard'
import { SupabaseStatusCard } from '@/features/dashboard/supabase-status-card'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// 로그인 사용자 구분에 따라 화주사용 / 3PL용 대시보드를 보여 준다
export function DashboardPage() {
  const { profile } = useAuth()
  return isShipperUser(profile) ? <ShipperDashboard /> : <InternalDashboard />
}

function InternalDashboard() {
  const navigate = useNavigate()
  const today = todayKst()
  const { data: todayPlans, isLoading } = usePlans(today, today)
  const { data: pending } = usePendingCounts()
  const active = todayPlans?.filter((p) => p.status === 'PENDING' || p.status === 'APPROVED')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm">{today} 입고 현황</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="오늘 입고예정"
          value={active?.length}
          icon={CalendarClock}
          to="/inbound/plans"
        />
        <KpiCard
          title="오늘 승인 완료"
          value={todayPlans?.filter((p) => p.status === 'APPROVED').length}
          icon={CheckCircle2}
          to="/inbound/plans"
        />
        <KpiCard
          title="승인대기 입고예정"
          value={pending?.plans}
          icon={ClipboardList}
          to="/inbound/plans"
          tone={pending?.plans ? 'text-amber-600' : ''}
        />
        <KpiCard
          title="승인대기 품목"
          value={pending?.items}
          icon={PackageCheck}
          to="/master/items"
          tone={pending?.items ? 'text-amber-600' : ''}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>오늘 입고예정</CardTitle>
            <CardDescription>
              승인대기·승인 전표입니다. 행을 누르면 상세로 이동합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !active?.length ? (
              <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                오늘 입고예정이 없습니다.
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {active.map((p) => (
                  <li
                    key={p.id}
                    className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                    onClick={() => navigate(`/inbound/plans/${p.id}`)}
                  >
                    <span className="font-mono">{p.plan_no}</span>
                    <span className="flex-1 truncate">{p.shipper_name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {p.line_count}품목 · {formatQty(p.total_approved_qty ?? p.total_plan_qty)}
                    </span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <SupabaseStatusCard />
      </div>
    </div>
  )
}
