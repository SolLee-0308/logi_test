import { useRef, useState, type DragEvent } from 'react'
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { cn } from '@/lib/utils'
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
  // 파일 읽기 상태: 화면에 항상 결과를 보여 준다
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const valid = rows.filter((r) => !r.error && !r.saved)

  const onFile = async (file: File) => {
    setFileName(file.name)
    setReadError(null)
    setRows([])
    if (!/.(xlsx|xls|csv)$/i.test(file.name)) {
      setReadError('엑셀 파일(.xlsx, .xls, .csv)만 업로드할 수 있습니다.')
      return
    }
    setReading(true)
    try {
      await parseFile(file)
    } catch (e) {
      setReadError(`파일을 읽지 못했습니다. (${toErrorMessage(e)})`)
    } finally {
      setReading(false)
    }
  }

  const parseFile = async (file: File) => {
    const XLSX = await loadXlsx()
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
      defval: '',
      raw: false,
      blankrows: false,
    })
    if (json.length === 0) {
      setReadError(
        `첫 번째 시트(${wb.SheetNames[0]})에 데이터 행이 없습니다. 2행부터 품목을 입력하세요.`,
      )
      return
    }
    const missing = HEADERS.slice(0, 3).filter((h) => !(h in json[0]))
    if (missing.length) {
      setReadError(
        `양식의 열 제목이 다릅니다. 누락된 열: ${missing.join(', ')} — 양식을 다시 내려받아 작성하세요.`,
      )
      return
    }
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
    if (!o) {
      setRows([])
      setFileName(null)
      setReadError(null)
    }
    onOpenChange(o)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
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

        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            ① 양식 다운로드 → ② 품목 시트에 작성 → ③ 아래 영역에 파일 올리기 → ④ 결과 확인 후 저장
          </p>
          <Button variant="outline" onClick={() => downloadTemplate(shippers ?? [], uoms ?? [])}>
            <FileSpreadsheet /> 양식 다운로드
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          {reading ? (
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          ) : (
            <Upload className="text-muted-foreground size-6" />
          )}
          <span className="font-medium">
            {reading ? '파일을 읽는 중…' : '여기를 클릭하거나 엑셀 파일을 끌어다 놓으세요'}
          </span>
          {fileName && <span className="text-muted-foreground">선택한 파일: {fileName}</span>}
        </button>

        {readError && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <span>{readError}</span>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="bg-muted rounded-md px-2 py-1">전체 {rows.length}건</span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
              저장 가능 {valid.length}건
            </span>
            <span className="bg-destructive/10 text-destructive rounded-md px-2 py-1">
              오류 {rows.filter((r) => r.error).length}건
            </span>
            {rows.some((r) => r.saved) && (
              <span className="rounded-md bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-400">
                저장됨 {rows.filter((r) => r.saved).length}건
              </span>
            )}
          </div>
        )}

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
