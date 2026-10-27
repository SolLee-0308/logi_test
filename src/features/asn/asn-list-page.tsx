import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'

import { isShipperUser, useAuth } from '@/lib/auth-context'
import { formatQty, todayKst } from '@/lib/date'
import { ASN_STATUS_LABEL, type AsnStatus, type AsnSummary } from '@/lib/types'
import { useAsns } from '@/features/asn/api'
import { ShipperFilter } from '@/features/master/shipper-filter'
import { DataTable } from '@/components/common/data-table'
import type { DataColumn } from '@/components/common/data-table-features'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const columns: DataColumn<AsnSummary>[] = [
  {
    accessorKey: 'asn_no',
    header: 'ASN 번호',
    cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
  },
  { accessorKey: 'asn_date', header: '입고일자' },
  { accessorKey: 'shipper_name', header: '화주사' },
  {
    accessorKey: 'vehicle_no',
    header: '차량번호',
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  },
  { accessorKey: 'driver_name', header: '기사' },
  { accessorKey: 'line_count', header: '품목수' },
  {
    accessorKey: 'total_order_qty',
    header: '지시수량',
    cell: ({ getValue }) => <span className="tabular-nums">{formatQty(getValue())}</span>,
  },
  {
    accessorKey: 'total_loaded_qty',
    header: '상차수량',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.loading_id ? formatQty(row.original.total_loaded_qty) : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <StatusBadge status={row.original.status} kind="asn" />
        {row.original.loading_status === 'LOADING' && (
          <span className="text-xs text-amber-600">상차중</span>
        )}
      </div>
    ),
  },
]

const TABS: ('ALL' | AsnStatus)[] = ['ALL', 'REGISTERED', 'LOADED', 'RECEIVED', 'CANCELLED']

export function AsnListPage() {
  const { profile } = useAuth()
  const shipperUser = isShipperUser(profile)
  const navigate = useNavigate()
  const [from, setFrom] = useState(todayKst(-7))
  const [to, setTo] = useState(todayKst(7))
  const [status, setStatus] = useState<'ALL' | AsnStatus>('ALL')
  const [shipperId, setShipperId] = useState('all')
  const { data, isLoading } = useAsns(from, to)

  const rows = useMemo(
    () =>
      data?.filter(
        (a) =>
          (status === 'ALL' || a.status === status) &&
          (shipperId === 'all' || a.shipper_id === shipperId),
      ),
    [data, status, shipperId],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="ASN·상차지시"
        description={
          shipperUser
            ? '승인된 입고예정을 차량별로 나눠 ASN을 등록하고 상차지시서를 출력합니다.'
            : '화주사가 등록한 차량별 ASN(상차지시)을 조회합니다. 같은 차량번호로 여러 화주사의 ASN이 있을 수 있습니다.'
        }
        actions={
          shipperUser && (
            <Button onClick={() => navigate('/inbound/asn/new')}>
              <Plus /> ASN 등록
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <TabsList>
            {TABS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {s === 'ALL' ? '전체' : ASN_STATUS_LABEL[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">입고일자</span>
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
        searchPlaceholder="ASN 번호, 차량번호, 화주사 검색"
        emptyMessage="조회 기간에 ASN이 없습니다."
        onRowClick={(row) => navigate(`/inbound/asn/${row.id}`)}
        toolbar={!shipperUser && <ShipperFilter value={shipperId} onChange={setShipperId} />}
      />
    </div>
  )
}
