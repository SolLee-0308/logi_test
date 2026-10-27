import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { useAuth } from '@/lib/auth-context'
import { formatQty, todayKst } from '@/lib/date'
import { useCodeMap, useVehicles } from '@/features/master/api'
import { useAsn, useOpenPlanLines, useSaveAsn } from '@/features/asn/api'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Existing = ReturnType<typeof useAsn>['data']

// 수정 시 기존 ASN을 불러온 뒤 폼을 그린다. ?date=YYYY-MM-DD 로 일자를 미리 지정할 수 있다.
export function AsnFormPage() {
  const { id } = useParams()
  const { data: existing, isLoading } = useAsn(id)
  if (id && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  return <AsnForm key={id ?? 'new'} id={id} existing={existing} />
}

function AsnForm({ id, existing }: { id: string | undefined; existing: Existing }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const shipperId = existing?.asn?.shipper_id ?? profile?.shipper_id ?? ''
  const { data: vehicles } = useVehicles()
  const uomMap = useCodeMap('UOM')
  const save = useSaveAsn()

  const [asnDate, setAsnDate] = useState(
    existing?.asn?.asn_date ?? params.get('date') ?? todayKst(),
  )
  const [vehicleId, setVehicleId] = useState(existing?.asn?.vehicle_id ?? '')
  const [remark, setRemark] = useState(existing?.asn?.remark ?? '')
  // 입고예정 라인별 이 차량 배정 수량
  const [qty, setQty] = useState<Record<string, number | ''>>(() =>
    Object.fromEntries((existing?.lines ?? []).map((l) => [l.plan_line_id, Number(l.order_qty)])),
  )
  const [formError, setFormError] = useState<string | null>(null)

  const { data: openLines, isLoading } = useOpenPlanLines(shipperId, asnDate)
  // 수정 중인 ASN 자신의 배정분은 잔여 수량에 더해서 보여 준다
  const ownQty = useMemo(
    () => new Map((existing?.lines ?? []).map((l) => [l.plan_line_id, Number(l.order_qty)])),
    [existing],
  )
  const rows = useMemo(
    () =>
      (openLines ?? [])
        .map((l) => ({
          ...l,
          available: Number(l.remaining_qty) + (ownQty.get(l.plan_line_id) ?? 0),
        }))
        .filter((l) => l.available > 0),
    [openLines, ownQty],
  )
  const myVehicles = (vehicles ?? []).filter((v) => v.shipper_id === shipperId && v.is_active)
  const total = rows.reduce((s, r) => s + (Number(qty[r.plan_line_id]) || 0), 0)
  const notEditable =
    existing?.asn && (existing.asn.status !== 'REGISTERED' || existing.asn.loading_id)

  const changeDate = (v: string) => {
    if (Object.values(qty).some((q) => Number(q) > 0)) {
      if (!window.confirm('일자를 바꾸면 입력한 배정 수량이 지워집니다. 계속할까요?')) return
    }
    setAsnDate(v)
    setQty({})
  }

  const onSubmit = () => {
    setFormError(null)
    if (!vehicleId) return setFormError('차량을 선택하세요.')
    const over = rows.find((r) => Number(qty[r.plan_line_id]) > r.available)
    if (over)
      return setFormError(
        `${over.item_name}: 배정 가능 수량(${formatQty(over.available)})을 넘었습니다.`,
      )
    const lines = rows
      .filter((r) => Number(qty[r.plan_line_id]) > 0)
      .map((r) => ({ plan_line_id: r.plan_line_id, order_qty: Number(qty[r.plan_line_id]) }))
    if (lines.length === 0) return setFormError('이 차량에 실을 품목 수량을 1건 이상 입력하세요.')
    save.mutate(
      { asnId: id ?? null, shipperId, asnDate, vehicleId, remark, lines },
      { onSuccess: (asnId) => navigate(`/inbound/asn/${asnId}`, { replace: true }) },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={id ? `ASN 수정 ${existing?.asn?.asn_no ?? ''}` : 'ASN 등록'}
        description="입고일자의 승인된 입고예정 품목 중 이 차량에 실을 수량을 입력합니다. 여러 입고예정의 품목을 한 차량에 실을 수 있습니다."
      />

      {notEditable && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
          상차가 시작되었거나 등록 상태가 아니라 수정할 수 없습니다.
        </p>
      )}

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="asn_date">
              입고일자<span className="text-destructive">*</span>
            </Label>
            <Input
              id="asn_date"
              type="date"
              value={asnDate}
              onChange={(e) => changeDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              차량<span className="text-destructive">*</span>
            </Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={myVehicles.length ? '차량 선택' : '등록된 차량이 없습니다'}
                />
              </SelectTrigger>
              <SelectContent>
                {myVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.vehicle_no}
                    {v.driver_name ? ` · ${v.driver_name}` : ''}
                    {v.tonnage ? ` · ${v.tonnage}톤` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remark">비고</Label>
            <Input id="remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            배정할 품목{' '}
            <span className="text-muted-foreground text-sm font-normal">
              {rows.length}건 · 이 차량 합계 {formatQty(total)}
            </span>
          </CardTitle>
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              setQty(Object.fromEntries(rows.map((r) => [r.plan_line_id, r.available])))
            }
          >
            잔량 전체 배정
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>입고예정</TableHead>
                  <TableHead>화주 품목코드</TableHead>
                  <TableHead>품명</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead className="text-right">승인수량</TableHead>
                  <TableHead className="text-right">배정 가능</TableHead>
                  <TableHead className="w-36">이 차량 수량</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground h-28 text-center">
                      {asnDate} 에 배정할 승인 품목이 없습니다. 입고예정이 승인되었는지, 이미 모두
                      배정했는지 확인하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const v = qty[r.plan_line_id] ?? ''
                    const over = Number(v) > r.available
                    return (
                      <TableRow key={r.plan_line_id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {r.plan_no}
                        </TableCell>
                        <TableCell className="font-mono">{r.shipper_item_code}</TableCell>
                        <TableCell>
                          {r.item_name}
                          {r.spec && <span className="text-muted-foreground"> · {r.spec}</span>}
                        </TableCell>
                        <TableCell>{uomMap.get(r.uom_code) ?? r.uom_code}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQty(r.approved_qty)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQty(r.available)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={r.available}
                              value={v}
                              aria-invalid={over}
                              onChange={(e) =>
                                setQty((p) => ({
                                  ...p,
                                  [r.plan_line_id]:
                                    e.target.value === '' ? '' : Number(e.target.value),
                                }))
                              }
                              className="text-right tabular-nums"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setQty((p) => ({ ...p, [r.plan_line_id]: r.available }))
                              }
                            >
                              전량
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          취소
        </Button>
        <Button onClick={onSubmit} disabled={save.isPending || Boolean(notEditable)}>
          {save.isPending ? '저장 중…' : 'ASN 저장'}
        </Button>
      </div>
    </div>
  )
}
