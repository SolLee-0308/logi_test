import type { Item } from '@/lib/types'
import { loadXlsx } from '@/features/master/items-export'

const HEADERS = ['화주품목코드', '바코드', '수량', '비고'] as const

export async function downloadPlanTemplate() {
  const XLSX = await loadXlsx()
  const ws = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    ['P-001', '', 10, '샘플 (이 행은 지우고 작성)'],
  ])
  ws['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 30 }]
  const guide = XLSX.utils.aoa_to_sheet([
    ['열 이름', '필수', '입력 규칙'],
    ['화주품목코드', '둘 중 하나', '선택한 화주사의 승인된 품목코드'],
    ['바코드', '둘 중 하나', '화주품목코드가 없으면 바코드로 품목을 찾습니다'],
    ['수량', '필수', '0보다 큰 숫자'],
    ['비고', '선택', ''],
  ])
  guide['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 48 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '입고예정')
  XLSX.utils.book_append_sheet(wb, guide, '작성안내')
  XLSX.writeFile(wb, '입고예정_품목_양식.xlsx')
}

export type ParsedPlanLine = { item: Item; plan_qty: number; remark: string | null }

// 엑셀 행 → 품목 매칭. 같은 품목이 여러 행이면 수량을 합친다.
export async function parsePlanExcel(file: File, items: Item[]) {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: '',
    raw: false,
    blankrows: false,
  })
  if (rows.length === 0) throw new Error('첫 번째 시트에 데이터 행이 없습니다.')
  if (!('수량' in rows[0])) throw new Error("양식의 열 제목이 다릅니다. '수량' 열이 필요합니다.")

  const byCode = new Map(items.map((i) => [i.shipper_item_code.toUpperCase(), i]))
  const byBarcode = new Map(items.filter((i) => i.barcode).map((i) => [i.barcode!, i]))
  const merged = new Map<string, ParsedPlanLine>()
  const errors: string[] = []

  rows.forEach((r, idx) => {
    const rowNo = idx + 2
    const code = String(r['화주품목코드'] ?? '')
      .trim()
      .toUpperCase()
    const barcode = String(r['바코드'] ?? '').trim()
    const qty = Number(String(r['수량'] ?? '').replace(/,/g, ''))
    const item = (code && byCode.get(code)) || (barcode && byBarcode.get(barcode)) || undefined
    if (!code && !barcode) return errors.push(`${rowNo}행: 화주품목코드 또는 바코드가 없습니다.`)
    if (!item)
      return errors.push(`${rowNo}행: 승인된 품목을 찾을 수 없습니다. (${code || barcode})`)
    if (!Number.isFinite(qty) || qty <= 0)
      return errors.push(`${rowNo}행: 수량이 올바르지 않습니다.`)
    const prev = merged.get(item.id)
    const remark = String(r['비고'] ?? '').trim() || null
    merged.set(item.id, {
      item,
      plan_qty: (prev?.plan_qty ?? 0) + qty,
      remark: prev?.remark ?? remark,
    })
  })
  return { lines: [...merged.values()], errors }
}
