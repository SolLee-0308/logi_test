import { useState } from 'react'
import { CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { toErrorMessage } from '@/lib/errors'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import { masterKeys, useCodes, useShippers } from '@/features/master/api'
import { HEADERS, downloadTemplate, loadXlsx } from '@/features/master/items-export'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const yn = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => v === 'Y')

const rowSchema = z.object({
  화주코드: z.string().trim().min(1, '화주코드 누락'),
  화주품목코드: z.string().trim().min(1, '화주품목코드 누락').max(50),
  품명: z.string().trim().min(1, '품명 누락').max(200),
  규격: z.string().trim().max(200).optional(),
  바코드: z.string().trim().max(50).optional(),
  단위: z.string().trim().toUpperCase().default('EA'),
  입수량: z.coerce.number().int().positive().optional(),
  '로트관리(Y/N)': yn,
  '유통기한관리(Y/N)': yn,
})

type ParsedRow = {
  rowNo: number
  raw: Record<string, string>
  values?: Record<string, unknown>
  error?: string
  saved?: boolean
}

export function ItemsExcelDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: shippers } = useShippers()
  const { data: uoms } = useCodes('UOM')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)

  const valid = rows.filter((r) => !r.error && !r.saved)

  const onFile = async (file: File) => {
    const XLSX = await loadXlsx()
    const wb = XLSX.read(await file.arrayBuffer())
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
      defval: '',
      raw: false,
    })
    const shipperByCode = new Map((shippers ?? []).map((s) => [s.shipper_code, s]))
    const uomSet = new Set((uoms ?? []).map((u) => u.code))
    const seen = new Set<string>()

    setRows(
      json.map((obj, idx) => {
        const raw = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.trim(), String(v)]))
        const cleaned = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, v.trim() === '' ? undefined : v]),
        )
        const rowNo = idx + 2
        const parsed = rowSchema.safeParse(cleaned)
        if (!parsed.success)
          return { rowNo, raw, error: parsed.error.issues.map((i) => i.message).join(', ') }
        const v = parsed.data
        const shipper = shipperByCode.get(v.화주코드.toUpperCase())
        if (!shipper) return { rowNo, raw, error: `없는 화주코드 (${v.화주코드})` }
        if (!uomSet.has(v.단위)) return { rowNo, raw, error: `없는 단위 (${v.단위})` }
        const key = `${shipper.id}|${v.화주품목코드}`
        if (seen.has(key)) return { rowNo, raw, error: '파일 안에서 화주품목코드 중복' }
        seen.add(key)
        return {
          rowNo,
          raw,
          values: {
            shipper_id: shipper.id,
            shipper_item_code: v.화주품목코드,
            item_name: v.품명,
            spec: v.규격 ?? null,
            barcode: v.바코드 ?? null,
            uom_code: v.단위,
            box_qty: v.입수량 ?? null,
            lot_yn: v['로트관리(Y/N)'],
            expiry_yn: v['유통기한관리(Y/N)'],
          },
        }
      }),
    )
  }

  // 행 단위로 저장해 DB 중복 오류를 행별로 표시
  const onSave = async () => {
    setSaving(true)
    const next = [...rows]
    let okCount = 0
    for (const row of next) {
      if (row.error || row.saved) continue
      const { error } = await supabase!.from('items').insert(row.values!)
      if (error) row.error = toErrorMessage(error)
      else {
        row.saved = true
        okCount++
      }
    }
    setRows(next)
    setSaving(false)
    queryClient.invalidateQueries({ queryKey: masterKeys.items })
    const failCount = next.filter((r) => r.error).length
    if (failCount) toast.warning(`${okCount}건 저장, ${failCount}건 오류가 있습니다.`)
    else toast.success(`${okCount}건을 저장했습니다.`)
  }

  const close = (o: boolean) => {
    if (!o) setRows([])
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>품목 엑셀 일괄등록</DialogTitle>
          <DialogDescription>
            양식을 내려받아 작성한 뒤 업로드하세요. 검증을 통과한 행만 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <FileSpreadsheet /> 양식 다운로드
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
            <span className="bg-primary text-primary-foreground inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-sm font-medium">
              파일 선택
            </span>
          </label>
          {rows.length > 0 && (
            <span className="text-muted-foreground text-sm">
              전체 {rows.length}건 · 저장 가능 {valid.length}건 · 오류{' '}
              {rows.filter((r) => r.error).length}건
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted sticky top-0">
                <TableRow>
                  <TableHead>행</TableHead>
                  <TableHead>결과</TableHead>
                  {HEADERS.slice(0, 6).map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.rowNo}>
                    <TableCell>{r.rowNo}</TableCell>
                    <TableCell className="min-w-40">
                      {r.saved ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="size-4" /> 저장됨
                        </span>
                      ) : r.error ? (
                        <span className="text-destructive inline-flex items-center gap-1">
                          <XCircle className="size-4" /> {r.error}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">저장 대기</span>
                      )}
                    </TableCell>
                    {HEADERS.slice(0, 6).map((h) => (
                      <TableCell key={h}>{r.raw[h]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            닫기
          </Button>
          <Button onClick={onSave} disabled={valid.length === 0 || saving}>
            {saving ? '저장 중…' : `${valid.length}건 저장`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
