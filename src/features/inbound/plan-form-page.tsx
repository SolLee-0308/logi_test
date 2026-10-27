import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { FileSpreadsheet, Trash2, Upload, XCircle } from 'lucide-react'

import { isShipperUser, useAuth } from '@/lib/auth-context'
import { todayKst } from '@/lib/date'
import { toErrorMessage } from '@/lib/errors'
import type { Item, SourceType } from '@/lib/types'
import { useCodeMap, useItems, useShippers } from '@/features/master/api'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlan, useSavePlan } from '@/features/inbound/api'
import { ItemPicker } from '@/features/inbound/item-picker'
import { downloadPlanTemplate, parsePlanExcel } from '@/features/inbound/plan-lines-excel'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Line = { item: Item; plan_qty: number | ''; remark: string }

// 수정 시 기존 전표와 품목을 모두 불러온 뒤 폼을 그린다
export function PlanFormPage() {
  const { id } = useParams()
  const { data: existing, isLoading } = usePlan(id)
  const { data: allItems } = useItems()
  if (!allItems || (id && isLoading)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  return <PlanForm key={id ?? 'new'} id={id} existing={existing} allItems={allItems} />
}

function PlanForm({
  id,
  existing,
  allItems,
}: {
  id: string | undefined
  existing: ReturnType<typeof usePlan>['data']
  allItems: Item[]
}) {
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const shipperUser = isShipperUser(profile)
  const { data: shippers } = useShippers()
  const uomMap = useCodeMap('UOM')
  const save = useSavePlan()
  const plan = existing?.plan

  const [shipperId, setShipperId] = useState<string>(
    plan?.shipper_id ?? (shipperUser ? (profile?.shipper_id ?? '') : ''),
  )
  const [planDate, setPlanDate] = useState(plan?.plan_date ?? todayKst())
  const [remark, setRemark] = useState(plan?.remark ?? '')
  const [sourceType, setSourceType] = useState<SourceType>(plan?.source_type ?? 'MANUAL')
  const [lines, setLines] = useState<Line[]>(() => {
    const itemMap = new Map(allItems.map((i) => [i.id, i]))
    return (existing?.lines ?? [])
      .filter((l) => itemMap.has(l.item_id))
      .map((l) => ({
        item: itemMap.get(l.item_id)!,
        plan_qty: Number(l.plan_qty),
        remark: l.remark ?? '',
      }))
  })
  const [excelErrors, setExcelErrors] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const shipperItems = useMemo(
    () =>
      allItems.filter(
        (i) => i.shipper_id === shipperId && i.is_active && i.approval_status === 'APPROVED',
      ),
    [allItems, shipperId],
  )
  const selectedIds = useMemo(() => new Set(lines.map((l) => l.item.id)), [lines])
  const totalQty = lines.reduce((s, l) => s + (Number(l.plan_qty) || 0), 0)

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const changeShipper = (v: string) => {
    if (
      lines.length > 0 &&
      !window.confirm('화주사를 바꾸면 입력한 품목이 모두 지워집니다. 계속할까요?')
    )
      return
    setShipperId(v)
    setLines([])
  }

  const onExcel = async (file: File) => {
    setExcelErrors([])
    try {
      const { lines: parsed, errors } = await parsePlanExcel(file, shipperItems)
      setExcelErrors(errors)
      setLines((prev) => {
        const next = [...prev]
        for (const p of parsed) {
          const idx = next.findIndex((l) => l.item.id === p.item.id)
          if (idx >= 0)
            next[idx] = { ...next[idx], plan_qty: (Number(next[idx].plan_qty) || 0) + p.plan_qty }
          else next.push({ item: p.item, plan_qty: p.plan_qty, remark: p.remark ?? '' })
        }
        return next
      })
      if (parsed.length > 0) setSourceType('EXCEL')
    } catch (e) {
      setExcelErrors([toErrorMessage(e)])
    }
  }

  const onSubmit = () => {
    setFormError(null)
    if (!shipperId) return setFormError('화주사를 선택하세요.')
    if (!planDate) return setFormError('입고예정일을 입력하세요.')
    if (lines.length === 0) return setFormError('입고 품목을 1건 이상 추가하세요.')
    const bad = lines.findIndex((l) => !(Number(l.plan_qty) > 0))
    if (bad >= 0) return setFormError(`${bad + 1}번 품목의 수량을 0보다 크게 입력하세요.`)
    save.mutate(
      {
        planId: id ?? null,
        shipperId,
        planDate,
        remark,
        sourceType,
        lines: lines.map((l) => ({
          item_id: l.item.id,
          plan_qty: Number(l.plan_qty),
          remark: l.remark || null,
        })),
      },
      { onSuccess: (planId) => navigate(`/inbound/plans/${planId}`, { replace: true }) },
    )
  }

  const notEditable = isEdit && plan && plan.status !== 'PENDING'

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? `입고예정 수정 ${plan?.plan_no ?? ''}` : '입고예정 등록'}
        description="입고할 품목과 수량을 입력하고 저장하면 '승인대기' 상태가 됩니다. 승인 전까지 수정·취소할 수 있습니다."
      />

      {notEditable && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
          승인대기 상태가 아니라 수정할 수 없습니다.
        </p>
      )}

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>
              화주사<span className="text-destructive">*</span>
            </Label>
            {shipperUser ? (
              <Input
                value={shippers?.find((s) => s.id === shipperId)?.shipper_name ?? ''}
                disabled
              />
            ) : (
              <Select value={shipperId} onValueChange={changeShipper} disabled={isEdit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="화주사 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(shippers ?? [])
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shipper_name} ({s.shipper_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan_date">
              입고예정일<span className="text-destructive">*</span>
            </Label>
            <Input
              id="plan_date"
              type="date"
              min={todayKst()}
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
            />
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
            입고 품목{' '}
            <span className="text-muted-foreground text-sm font-normal">
              {lines.length}건 · 합계 {totalQty.toLocaleString()}
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={downloadPlanTemplate}>
              <FileSpreadsheet /> 양식
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onExcel(f)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              disabled={!shipperId}
              onClick={() => fileRef.current?.click()}
            >
              <Upload /> 엑셀로 불러오기
            </Button>
            <ItemPicker
              items={shipperItems}
              excludeIds={selectedIds}
              disabled={!shipperId}
              onSelect={(item) =>
                setLines((prev) => [...prev, { item, plan_qty: item.box_qty ?? 1, remark: '' }])
              }
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {excelErrors.length > 0 && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-1 font-medium">
                <XCircle className="size-4" /> 엑셀에서 불러오지 못한 행 {excelErrors.length}건
              </div>
              <ul className="list-disc pl-5">
                {excelErrors.slice(0, 10).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>화주 품목코드</TableHead>
                  <TableHead>품명</TableHead>
                  <TableHead>규격</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead className="w-32">수량</TableHead>
                  <TableHead>비고</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-28 text-center">
                      {shipperId
                        ? "'품목 추가' 또는 '엑셀로 불러오기'로 입고 품목을 입력하세요."
                        : '먼저 화주사를 선택하세요.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((l, idx) => (
                    <TableRow key={l.item.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono">{l.item.shipper_item_code}</TableCell>
                      <TableCell>{l.item.item_name}</TableCell>
                      <TableCell>{l.item.spec}</TableCell>
                      <TableCell>{uomMap.get(l.item.uom_code) ?? l.item.uom_code}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={l.plan_qty}
                          aria-invalid={!(Number(l.plan_qty) > 0)}
                          onChange={(e) =>
                            updateLine(idx, {
                              plan_qty: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          className="text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={l.remark}
                          onChange={(e) => updateLine(idx, { remark: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="삭제"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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
          {save.isPending ? '저장 중…' : '저장 (승인 요청)'}
        </Button>
      </div>
    </div>
  )
}
