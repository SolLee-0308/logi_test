import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'

import { isShipperUser, useAuth } from '@/lib/auth-context'
import { todayKst, formatQty } from '@/lib/date'
import {
  PLAN_STATUS_LABEL,
  SOURCE_LABEL,
  type InboundPlanSummary,
  type PlanStatus,
} from '@/lib/types'
import { usePlans } from '@/features/inbound/api'
import { ShipperFilter } from '@/features/master/shipper-filter'
import { DataTable } from '@/components/common/data-table'
import type { DataColumn } from '@/components/common/data-table-features'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const columns: DataColumn<InboundPlanSummary>[] = [
  {
    accessorKey: 'plan_no',
    header: '전표번호',
    cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
  },
  { accessorKey: 'plan_date', header: '입고예정일' },
  { accessorKey: 'shipper_name', header: '화주사' },
  { accessorKey: 'line_count', header: '품목수' },
  {
    accessorKey: 'total_plan_qty',
    header: '예정수량',
    cell: ({ getValue }) => <span className="tabular-nums">{formatQty(getValue())}</span>,
  },
  {
    accessorKey: 'total_approved_qty',
    header: '승인수량',
    cell: ({ getValue }) => <span className="tabular-nums">{formatQty(getValue())}</span>,
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  },
  { id: 'source', header: '등록방식', accessorFn: (r) => SOURCE_LABEL[r.source_type] },
  { accessorKey: 'created_by_name', header: '등록자' },
]

const STATUS_TABS: ('ALL' | PlanStatus)[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

export function PlansPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [from, setFrom] = useState(todayKst(-7))
  const [to, setTo] = useState(todayKst(7))
  const [status, setStatus] = useState<'ALL' | PlanStatus>('ALL')
  const [shipperId, setShipperId] = useState('all')
  const { data, isLoading } = usePlans(from, to)

  const rows = useMemo(
    () =>
      data?.filter(
        (p) =>
          (status === 'ALL' || p.status === status) &&
          (shipperId === 'all' || p.shipper_id === shipperId),
      ),
    [data, status, shipperId],
  )
  const countOf = (s: PlanStatus) => data?.filter((p) => p.status === s).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="입고예정"
        description="화주사가 등록한 입고예정을 조회하고, 3PL이 검토·승인합니다."
        actions={
          <Button onClick={() => navigate('/inbound/plans/new')}>
            <Plus /> 입고예정 등록
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {s === 'ALL' ? '전체' : PLAN_STATUS_LABEL[s]}
                {s === 'PENDING' && countOf('PENDING') > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                    {countOf('PENDING')}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">입고예정일</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
          <span>~</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="전표번호, 화주사 검색"
        emptyMessage="조회 기간에 입고예정이 없습니다."
        onRowClick={(row) => navigate(`/inbound/plans/${row.id}`)}
        toolbar={
          !isShipperUser(profile) && <ShipperFilter value={shipperId} onChange={setShipperId} />
        }
      />
    </div>
  )
}
