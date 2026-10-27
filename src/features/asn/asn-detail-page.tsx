import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Pencil, Printer } from 'lucide-react'

import { isShipperUser, useAuth } from '@/lib/auth-context'
import { formatDateTime, formatQty } from '@/lib/date'
import { useCodeMap } from '@/features/master/api'
import { useAsn, useCancelAsn } from '@/features/asn/api'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-medium">{children || '-'}</div>
    </div>
  )
}

export function AsnDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, isLoading } = useAsn(id)
  const vehicleTypeMap = useCodeMap('VEHICLE_TYPE')
  const uomMap = useCodeMap('UOM')
  const cancel = useCancelAsn()
  const [cancelOpen, setCancelOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  const asn = data?.asn
  if (!asn) return <p className="text-muted-foreground">ASN을 찾을 수 없습니다.</p>
  const lines = data.lines
  const editable = isShipperUser(profile) && asn.status === 'REGISTERED' && !asn.loading_id

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ASN ${asn.asn_no}`}
        description={`${asn.shipper_name} · 차량 ${asn.vehicle_no} · 입고일자 ${asn.asn_date}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/inbound/asn')}>
              <ArrowLeft /> 목록
            </Button>
            {editable && (
              <>
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  ASN 취소
                </Button>
                <Button variant="outline" onClick={() => navigate(`/inbound/asn/${asn.id}/edit`)}>
                  <Pencil /> 수정
                </Button>
              </>
            )}
            {asn.status !== 'CANCELLED' && (
              <Button onClick={() => window.open(`/print/asn/${asn.id}`, '_blank')}>
                <Printer /> 상차지시서 출력
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <Info label="상태">
            <span className="flex items-center gap-1">
              <StatusBadge status={asn.status} kind="asn" />
              {asn.loading_status === 'LOADING' && (
                <span className="text-xs text-amber-600">상차중</span>
              )}
            </span>
          </Info>
          <Info label="화주사">{`${asn.shipper_name} (${asn.shipper_code})`}</Info>
          <Info label="차량">
            {[
              asn.vehicle_no,
              asn.vehicle_type_code && vehicleTypeMap.get(asn.vehicle_type_code),
              asn.tonnage && `${asn.tonnage}톤`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Info>
          <Info label="기사">{[asn.driver_name, asn.driver_tel].filter(Boolean).join(' · ')}</Info>
          <Info label="등록">{`${asn.created_by_name ?? ''} ${formatDateTime(asn.created_at)}`}</Info>
          <Info label="상차">
            {asn.loading_no
              ? `${asn.loading_no}${asn.loaded_at ? ` · 완료 ${formatDateTime(asn.loaded_at)}` : ' · 진행중'}`
              : ''}
          </Info>
          {asn.remark && (
            <div className="sm:col-span-3 lg:col-span-6">
              <Info label="비고">{asn.remark}</Info>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            상차지시 품목{' '}
            <span className="text-muted-foreground text-sm font-normal">
              {lines.length}건 · 지시 {formatQty(asn.total_order_qty)}
              {asn.loading_id && ` · 상차 ${formatQty(asn.total_loaded_qty)}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>화주 품목코드</TableHead>
                  <TableHead>품명</TableHead>
                  <TableHead>바코드</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead className="text-right">지시수량</TableHead>
                  <TableHead className="text-right">상차수량</TableHead>
                  <TableHead>입고예정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => {
                  const diff = asn.loading_id && Number(l.loaded_qty) !== Number(l.order_qty)
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.line_no}</TableCell>
                      <TableCell className="font-mono">{l.shipper_item_code}</TableCell>
                      <TableCell>
                        {l.item_name}
                        {l.spec && <span className="text-muted-foreground"> · {l.spec}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {l.barcode}
                      </TableCell>
                      <TableCell>{uomMap.get(l.uom_code) ?? l.uom_code}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(l.order_qty)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${diff ? 'font-medium text-amber-600' : ''}`}
                      >
                        {asn.loading_id ? formatQty(l.loaded_qty) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {l.plan_no}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ASN을 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 차량에 배정한 수량이 입고예정의 미배정 수량으로 돌아갑니다. 출력한 상차지시서는
              폐기하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate(asn.id)}>ASN 취소</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
