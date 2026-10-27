import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, CheckCircle2, Copy, Pencil, XCircle } from 'lucide-react'

import { canApprove, useAuth } from '@/lib/auth-context'
import { formatDateTime, formatQty } from '@/lib/date'
import { SOURCE_LABEL } from '@/lib/types'
import { useCodeMap, useItems } from '@/features/master/api'
import { useApprovePlan, useCancelPlan, usePlan, useRejectPlan } from '@/features/inbound/api'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type Review = { approved_qty: number | ''; adjust_reason: string }

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-medium">{children || '-'}</div>
    </div>
  )
}

export function PlanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, isLoading } = usePlan(id)
  const { data: items } = useItems()
  const uomMap = useCodeMap('UOM')
  const approve = useApprovePlan()
  const reject = useRejectPlan()
  const cancel = useCancelPlan()

  const [review, setReview] = useState<Record<string, Review>>({})
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  const plan = data?.plan
  const lines = useMemo(() => data?.lines ?? [], [data])
  const itemMap = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items])
  const pending = plan?.status === 'PENDING'
  const reviewing = pending && canApprove(profile)

  // 승인 검토값: 입력 전에는 승인수량 = 예정수량
  const reviewOf = (l: { id: string; plan_qty: number }): Review =>
    review[l.id] ?? { approved_qty: Number(l.plan_qty), adjust_reason: '' }
  const patchReview = (l: { id: string; plan_qty: number }, patch: Partial<Review>) =>
    setReview((p) => ({ ...p, [l.id]: { ...reviewOf(l), ...patch } }))

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!plan) {
    return <p className="text-muted-foreground">입고예정을 찾을 수 없습니다.</p>
  }

  const approvedTotal = lines.reduce((s, l) => s + (Number(reviewOf(l).approved_qty) || 0), 0)
  const planTotal = lines.reduce((s, l) => s + Number(l.plan_qty), 0)

  const onApprove = () => {
    setReviewError(null)
    for (const l of lines) {
      const r = reviewOf(l)
      const qty = Number(r.approved_qty)
      if (r.approved_qty === '' || !(qty >= 0 && qty <= Number(l.plan_qty))) {
        return setReviewError(
          `${l.line_no}번 라인 승인수량은 0 ~ ${formatQty(l.plan_qty)} 사이여야 합니다.`,
        )
      }
      if (qty < Number(l.plan_qty) && !r.adjust_reason.trim()) {
        return setReviewError(
          `${l.line_no}번 라인은 예정보다 적게 승인하므로 조정 사유를 입력하세요.`,
        )
      }
    }
    if (approvedTotal === 0) return setReviewError('승인수량이 모두 0입니다. 승인 대신 반려하세요.')
    approve.mutate({
      planId: plan.id,
      lines: lines.map((l) => ({
        line_id: l.id,
        approved_qty: Number(reviewOf(l).approved_qty),
        adjust_reason: reviewOf(l).adjust_reason.trim() || null,
      })),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`입고예정 ${plan.plan_no}`}
        description={`${plan.shipper_name} · 입고예정일 ${plan.plan_date}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/inbound/plans')}>
              <ArrowLeft /> 목록
            </Button>
            {(plan.status === 'REJECTED' || plan.status === 'CANCELLED') && (
              <Button onClick={() => navigate(`/inbound/plans/new?copy=${plan.id}`)}>
                <Copy /> 복사해서 다시 등록
              </Button>
            )}
            {pending && (
              <>
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  전표 취소
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/inbound/plans/${plan.id}/edit`)}
                >
                  <Pencil /> 수정
                </Button>
              </>
            )}
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <Info label="상태">
            <StatusBadge status={plan.status} />
          </Info>
          <Info label="화주사">{`${plan.shipper_name} (${plan.shipper_code})`}</Info>
          <Info label="입고예정일">{plan.plan_date}</Info>
          <Info label="등록방식">{SOURCE_LABEL[plan.source_type]}</Info>
          <Info label="등록">{`${plan.created_by_name ?? ''} ${formatDateTime(plan.created_at)}`}</Info>
          <Info label={plan.status === 'REJECTED' ? '반려' : '승인'}>
            {plan.approved_at
              ? `${plan.approved_by_name ?? ''} ${formatDateTime(plan.approved_at)}`
              : ''}
          </Info>
          {plan.remark && (
            <div className="sm:col-span-3 lg:col-span-6">
              <Info label="비고">{plan.remark}</Info>
            </div>
          )}
          {plan.status === 'REJECTED' && plan.reject_reason && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm sm:col-span-3 lg:col-span-6">
              반려 사유: {plan.reject_reason}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {reviewing ? '품목별 검토' : '입고 품목'}{' '}
            <span className="text-muted-foreground text-sm font-normal">
              {lines.length}건 · 예정 {formatQty(planTotal)}
              {reviewing && ` · 승인 ${formatQty(approvedTotal)}`}
              {!reviewing &&
                plan.total_approved_qty != null &&
                ` · 승인 ${formatQty(plan.total_approved_qty)}`}
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
                  <TableHead>내부코드</TableHead>
                  <TableHead>품명</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead className="text-right">예정수량</TableHead>
                  <TableHead className={reviewing ? 'w-32' : 'text-right'}>승인수량</TableHead>
                  <TableHead>조정 사유</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => {
                  const item = itemMap.get(l.item_id)
                  const r = reviewOf(l)
                  const reduced = reviewing && Number(r.approved_qty) < Number(l.plan_qty)
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.line_no}</TableCell>
                      <TableCell className="font-mono">{item?.shipper_item_code}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {item?.internal_code}
                      </TableCell>
                      <TableCell>{item?.item_name}</TableCell>
                      <TableCell>
                        {item ? (uomMap.get(item.uom_code) ?? item.uom_code) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(l.plan_qty)}
                      </TableCell>
                      {reviewing ? (
                        <>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={Number(l.plan_qty)}
                              value={r.approved_qty}
                              onChange={(e) =>
                                patchReview(l, {
                                  approved_qty: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              className="text-right tabular-nums"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={reduced ? '감량 사유 필수' : ''}
                              disabled={!reduced}
                              aria-invalid={Boolean(reduced && !r.adjust_reason.trim())}
                              value={r.adjust_reason}
                              onChange={(e) => patchReview(l, { adjust_reason: e.target.value })}
                            />
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {l.approved_qty != null &&
                            Number(l.approved_qty) < Number(l.plan_qty) ? (
                              <span className="font-medium text-amber-600">
                                {formatQty(l.approved_qty)}
                              </span>
                            ) : (
                              formatQty(l.approved_qty)
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{l.adjust_reason}</TableCell>
                        </>
                      )}
                      <TableCell className="text-muted-foreground">{l.remark}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {reviewing && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                품목별 승인수량을 확인하세요. 예정보다 적게 승인하면 조정 사유가 필요합니다.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRejectOpen(true)}>
                  <XCircle /> 반려
                </Button>
                <Button onClick={onApprove} disabled={approve.isPending}>
                  <CheckCircle2 /> {approve.isPending ? '승인 중…' : '최종 승인'}
                </Button>
              </div>
            </div>
          )}
          {reviewError && <p className="text-destructive mt-2 text-sm">{reviewError}</p>}
        </CardContent>
      </Card>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입고예정 반려</AlertDialogTitle>
            <AlertDialogDescription>반려 사유는 화주사에 그대로 표시됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="예: 당일 적재 공간 부족으로 익일 재요청 바랍니다."
          />
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() =>
                reject.mutate(
                  { planId: plan.id, reason: rejectReason },
                  { onSuccess: () => setRejectOpen(false) },
                )
              }
            >
              반려
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입고예정을 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              취소한 전표는 다시 되돌릴 수 없습니다. 필요하면 새로 등록하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate(plan.id)}>전표 취소</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
