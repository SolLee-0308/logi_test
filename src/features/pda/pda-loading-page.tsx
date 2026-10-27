import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CheckCircle2, ChevronRight, Truck, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatQty } from '@/lib/date'
import { toErrorMessage } from '@/lib/errors'
import type { AsnLineView } from '@/lib/types'
import {
  useAdjustLoading,
  useCompleteLoading,
  useLoadingView,
  useScanLoading,
} from '@/features/asn/api'
import { QtyDialog } from '@/features/pda/qty-dialog'
import { ScanInput } from '@/features/pda/scan-input'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'

type Pending =
  | { mode: 'scan'; barcode: string; line: AsnLineView | undefined }
  | { mode: 'manual'; line: AsnLineView }
  | { mode: 'adjust'; line: AsnLineView }

type Feedback = { tone: 'ok' | 'error'; text: string } | null

// 상차 2단계: 품목 바코드 스캔 → 수량(누적) 입력, 목록 선택·정정, 상차완료
export function PdaLoadingPage() {
  const { loadingId = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = useLoadingView(loadingId)
  const scan = useScanLoading(loadingId)
  const adjust = useAdjustLoading(loadingId)
  const complete = useCompleteLoading(loadingId)
  const [pending, setPending] = useState<Pending | null>(null)
  const [picked, setPicked] = useState<AsnLineView | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />
  if (error || !data?.asn) {
    return (
      <p className="text-destructive p-4 text-sm">
        {toErrorMessage(error) || '상차 전표를 찾을 수 없습니다.'}
      </p>
    )
  }
  const { asn, lines } = data
  const doneCount = lines.filter((l) => Number(l.loaded_qty) === Number(l.order_qty)).length
  const allDone = doneCount === lines.length
  const completed = asn.loading_status === 'COMPLETED'

  const onScanItem = (barcode: string) => {
    setFeedback(null)
    const line = lines.find((l) => l.barcode === barcode)
    if (!line) {
      setFeedback({ tone: 'error', text: `상차지시에 없는 품목 바코드입니다. (${barcode})` })
      navigator.vibrate?.(300)
      return
    }
    setPending({ mode: 'scan', barcode, line })
  }

  const onConfirmQty = (qty: number) => {
    if (!pending) return
    const line = pending.line!
    if (pending.mode === 'adjust') {
      adjust.mutate(
        { asnLineId: line.id, qty },
        {
          onSuccess: () => {
            setFeedback({
              tone: 'ok',
              text: `${line.item_name} 상차수량을 ${formatQty(qty)}(으)로 정정했습니다.`,
            })
            setPending(null)
          },
        },
      )
      return
    }
    scan.mutate(
      pending.mode === 'scan' ? { barcode: pending.barcode, qty } : { asnLineId: line.id, qty },
      {
        onSuccess: () => {
          setFeedback({ tone: 'ok', text: `${line.item_name} +${formatQty(qty)}` })
          setPending(null)
        },
        onError: (e) => {
          setFeedback({ tone: 'error', text: toErrorMessage(e) })
          setPending(null)
          navigator.vibrate?.(300)
        },
      },
    )
  }

  if (completed) {
    return (
      <div className="bg-card space-y-4 rounded-2xl border p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
        <div>
          <h1 className="text-xl font-semibold">상차완료</h1>
          <p className="text-muted-foreground text-sm">
            {asn.asn_no} · 차량 {asn.vehicle_no} · {lines.length}품목{' '}
            {formatQty(asn.total_loaded_qty)}
          </p>
        </div>
        <Button className="h-12 w-full" onClick={() => navigate('/pda/loading')}>
          다음 차량 상차
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="bg-card rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Truck className="text-primary size-5" />
          <span className="text-lg font-bold">{asn.vehicle_no}</span>
          <span className="text-muted-foreground ml-auto font-mono text-xs">{asn.asn_no}</span>
        </div>
        <div className="text-muted-foreground mt-1 text-sm">
          {asn.shipper_name} · {asn.asn_date}
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(doneCount / Math.max(lines.length, 1)) * 100}%` }}
            />
          </div>
          <span className="tabular-nums">
            {doneCount}/{lines.length} 품목
          </span>
        </div>
      </div>

      <ScanInput
        placeholder="품목 바코드 스캔"
        disabled={Boolean(pending) || scan.isPending}
        autoRefocus={!picked}
        onScan={onScanItem}
      />

      {feedback && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-xl border p-3 text-sm',
            feedback.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {feedback.tone === 'ok' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          )}
          {feedback.text}
        </div>
      )}

      <ul className="space-y-2">
        {lines.map((l) => {
          const loaded = Number(l.loaded_qty)
          const order = Number(l.order_qty)
          const tone =
            loaded === order ? 'done' : loaded > order ? 'over' : loaded > 0 ? 'partial' : 'none'
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setPicked(l)}
                className={cn(
                  'bg-card flex w-full items-center gap-3 rounded-xl border p-3 text-left',
                  tone === 'done' && 'border-emerald-500/40 bg-emerald-500/5',
                  tone === 'over' && 'border-destructive/40 bg-destructive/5',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.item_name}</div>
                  <div className="text-muted-foreground truncate font-mono text-xs">
                    {l.shipper_item_code}
                    {l.barcode ? ` · ${l.barcode}` : ' · 바코드 없음'}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div
                    className={cn(
                      'text-lg font-semibold',
                      tone === 'done' && 'text-emerald-600',
                      tone === 'over' && 'text-destructive',
                      tone === 'partial' && 'text-amber-600',
                    )}
                  >
                    {formatQty(loaded)}
                    <span className="text-muted-foreground text-sm font-normal">
                      {' '}
                      / {formatQty(order)}
                    </span>
                  </div>
                  {tone === 'over' && (
                    <div className="text-destructive text-xs">초과 {formatQty(loaded - order)}</div>
                  )}
                </div>
                <ChevronRight className="text-muted-foreground size-4" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="bg-background/95 fixed inset-x-0 bottom-0 border-t p-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          {complete.error && (
            <p className="text-destructive text-sm">{toErrorMessage(complete.error)}</p>
          )}
          <Button
            className="h-14 w-full text-lg"
            disabled={!allDone || complete.isPending}
            onClick={() => complete.mutate()}
          >
            {allDone
              ? complete.isPending
                ? '처리 중…'
                : '상차완료'
              : `지시수량과 맞춰 주세요 (${doneCount}/${lines.length})`}
          </Button>
        </div>
      </div>

      {/* 품목 선택: 바코드 없이 수량 추가 / 상차수량 정정 */}
      <Sheet open={Boolean(picked)} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          {picked && (
            <>
              <SheetHeader>
                <SheetTitle>{picked.item_name}</SheetTitle>
                <SheetDescription>
                  지시 {formatQty(picked.order_qty)} · 상차 {formatQty(picked.loaded_qty)}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-2 p-4 pt-0">
                <Button
                  className="h-14 text-base"
                  onClick={() => {
                    setPending({ mode: 'manual', line: picked })
                    setPicked(null)
                  }}
                >
                  바코드 없이 수량 추가
                </Button>
                <Button
                  variant="outline"
                  className="h-14 text-base"
                  onClick={() => {
                    setPending({ mode: 'adjust', line: picked })
                    setPicked(null)
                  }}
                >
                  상차수량 정정
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <QtyDialog
        open={Boolean(pending)}
        title={pending?.line?.item_name ?? ''}
        description={
          pending
            ? pending.mode === 'adjust'
              ? `정정할 전체 상차수량을 입력하세요. (지시 ${formatQty(pending.line.order_qty)})`
              : `추가로 실은 수량 · 현재 ${formatQty(pending.line?.loaded_qty)} / 지시 ${formatQty(pending.line?.order_qty)}`
            : undefined
        }
        initial={pending?.mode === 'adjust' ? Number(pending.line.loaded_qty) : 1}
        min={pending?.mode === 'adjust' ? 0 : 1}
        confirmLabel={pending?.mode === 'adjust' ? '정정' : '상차 추가'}
        pending={scan.isPending || adjust.isPending}
        onConfirm={onConfirmQty}
        onClose={() => setPending(null)}
      />
    </div>
  )
}
