import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Package,
  PackagePlus,
  Plus,
  Truck,
} from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { formatDateTime, formatQty, todayKst } from '@/lib/date'
import { usePlans } from '@/features/inbound/api'
import { useUnassignedPlanLines } from '@/features/asn/api'
import { useItems, useShippers } from '@/features/master/api'
import { KpiCard } from '@/features/dashboard/kpi-card'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// 화주사 사용자 대시보드: 내 입고예정 진행 상황과 조치가 필요한 건 중심
// (조회 데이터는 DB 권한으로 자기 화주사 것만 내려온다)
export function ShipperDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: shippers } = useShippers()
  const today = todayKst()
  const tomorrow = todayKst(1)
  const { data: plans, isLoading } = usePlans(todayKst(-30), todayKst(30))
  const { data: items } = useItems()
  const { data: unassigned } = useUnassignedPlanLines(today)
  // 일자별 차량 미배정 품목 수·잔량
  const unassignedByDate = useMemo(() => {
    const map = new Map<string, { lines: number; qty: number }>()
    for (const u of unassigned ?? []) {
      const prev = map.get(u.plan_date) ?? { lines: 0, qty: 0 }
      map.set(u.plan_date, { lines: prev.lines + 1, qty: prev.qty + Number(u.remaining_qty) })
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [unassigned])

  const shipperName = shippers?.find((s) => s.id === profile?.shipper_id)?.shipper_name

  const summary = useMemo(() => {
    if (!plans || !items) return undefined
    const active = plans.filter((p) => p.status === 'PENDING' || p.status === 'APPROVED')
    return {
      upcoming: active.filter((p) => p.plan_date === today || p.plan_date === tomorrow),
      reviewing: plans.filter((p) => p.status === 'PENDING'),
      rejectedPlans: plans.filter((p) => p.status === 'REJECTED' && p.plan_date >= today),
      pendingItems: items.filter((i) => i.approval_status === 'PENDING'),
      rejectedItems: items.filter((i) => i.approval_status === 'REJECTED'),
      recent: [...plans].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    }
  }, [plans, items, today, tomorrow])

  const actionCount =
    (summary?.rejectedPlans.length ?? 0) +
    (summary?.rejectedItems.length ?? 0) +
    unassignedByDate.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {shipperName ? `${shipperName} 대시보드` : '대시보드'}
          </h1>
          <p className="text-muted-foreground text-sm">{today} 기준 입고 진행 현황</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/inbound/plans/new')}>
            <Plus /> 입고예정 등록
          </Button>
          <Button variant="outline" onClick={() => navigate('/master/items')}>
            <PackagePlus /> 품목 등록
          </Button>
          <Button variant="outline" onClick={() => navigate('/master/vehicles')}>
            <Truck /> 차량 등록
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="오늘·내일 입고예정"
          value={summary?.upcoming.length}
          icon={CalendarClock}
          to="/inbound/plans"
          sub="승인대기·승인 전표"
        />
        <KpiCard
          title="3PL 검토 중"
          value={summary?.reviewing.length}
          icon={Clock}
          to="/inbound/plans"
          sub="승인대기 — 이 상태에서만 수정·취소 가능"
        />
        <KpiCard
          title="반려 · 조치 필요"
          value={summary?.rejectedPlans.length}
          icon={AlertTriangle}
          to="/inbound/plans"
          tone={summary?.rejectedPlans.length ? 'text-destructive' : ''}
          sub="반려 사유 확인 후 다시 등록"
        />
        <KpiCard
          title="품목 승인대기"
          value={summary?.pendingItems.length}
          icon={Package}
          to={
            summary?.rejectedItems.length
              ? '/master/items?tab=REJECTED'
              : '/master/items?tab=PENDING'
          }
          tone={summary?.rejectedItems.length ? 'text-destructive' : ''}
          sub={
            summary?.rejectedItems.length
              ? `반려 ${summary.rejectedItems.length}건 있음`
              : '승인된 품목만 입고예정에 사용'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              조치 필요
              {actionCount > 0 && (
                <span className="bg-destructive rounded-full px-2 text-xs text-white">
                  {actionCount}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              차량(ASN) 미배정 승인분, 3PL이 반려한 입고예정과 품목입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!summary ? (
              <Skeleton className="h-24 w-full" />
            ) : actionCount === 0 ? (
              <div className="text-muted-foreground flex h-28 items-center justify-center rounded-lg border border-dashed text-sm">
                조치가 필요한 건이 없습니다 👍
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {unassignedByDate.map(([date, u]) => (
                  <li
                    key={date}
                    className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                    onClick={() => navigate(`/inbound/asn/new?date=${date}`)}
                  >
                    <Truck className="size-4 text-blue-600" />
                    <span>
                      {date} 승인분 중 <b>{u.lines}품목</b>(잔량 {formatQty(u.qty)}) 차량 미배정
                    </span>
                    <span className="text-primary ml-auto shrink-0 text-xs">ASN 등록 →</span>
                  </li>
                ))}
                {summary.rejectedPlans.map((p) => (
                  <li
                    key={p.id}
                    className="hover:bg-muted/40 cursor-pointer space-y-1 px-3 py-2 text-sm"
                    onClick={() => navigate(`/inbound/plans/new?copy=${p.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      <span className="font-mono">{p.plan_no}</span>
                      <span className="text-muted-foreground">입고예정 {p.plan_date}</span>
                      <span className="text-primary ml-auto text-xs">복사해서 다시 등록 →</span>
                    </div>
                    <p className="text-destructive">반려 사유: {p.reject_reason}</p>
                  </li>
                ))}
                {summary.rejectedItems.map((i) => (
                  <li key={i.id} className="hover:bg-muted/40 space-y-1 px-3 py-2 text-sm">
                    <Link to="/master/items?tab=REJECTED" className="block">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={i.approval_status} kind="approval" />
                        <span className="font-mono">{i.shipper_item_code}</span>
                        <span className="truncate">{i.item_name}</span>
                        <span className="text-primary ml-auto shrink-0 text-xs">
                          수정 후 재요청 →
                        </span>
                      </div>
                      <p className="text-destructive">반려 사유: {i.reject_reason}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 입고예정</CardTitle>
            <CardDescription>최근 등록한 전표와 진행 상태입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !summary?.recent.length ? (
              <div className="text-muted-foreground flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm">
                아직 등록한 입고예정이 없습니다.
                <Button size="sm" onClick={() => navigate('/inbound/plans/new')}>
                  <Plus /> 첫 입고예정 등록
                </Button>
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {summary.recent.map((p) => (
                  <li
                    key={p.id}
                    className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                    onClick={() => navigate(`/inbound/plans/${p.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{p.plan_no}</span>
                        <span className="text-muted-foreground">입고 {p.plan_date}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {p.line_count}품목 · 예정 {formatQty(p.total_plan_qty)}
                        {p.total_approved_qty != null &&
                          ` · 승인 ${formatQty(p.total_approved_qty)}`}
                        {' · '}등록 {formatDateTime(p.created_at)}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
