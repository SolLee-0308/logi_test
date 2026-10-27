import type { Item, Shipper } from '@/lib/types'

// 엑셀 양식 열 (순서 = 양식 순서)
export const HEADERS = [
  '화주코드',
  '화주품목코드',
  '품명',
  '규격',
  '바코드',
  '단위',
  '입수량',
  '로트관리(Y/N)',
  '유통기한관리(Y/N)',
] as const

export async function loadXlsx() {
  return import('xlsx')
}

export async function downloadTemplate() {
  const XLSX = await loadXlsx()
  const ws = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    ['SHA', 'P-001', '샘플 품목', '500ml', '8801234567890', 'EA', 24, 'N', 'Y'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '품목')
  XLSX.writeFile(wb, '품목_일괄등록_양식.xlsx')
}

export async function downloadItems(
  items: Item[],
  shipperMap: Map<string, Shipper>,
  uomMap: Map<string, string>,
) {
  const XLSX = await loadXlsx()
  const rows = items.map((i) => ({
    화주코드: shipperMap.get(i.shipper_id)?.shipper_code,
    화주명: shipperMap.get(i.shipper_id)?.shipper_name,
    내부코드: i.internal_code,
    화주품목코드: i.shipper_item_code,
    품명: i.item_name,
    규격: i.spec,
    바코드: i.barcode,
    단위: uomMap.get(i.uom_code) ?? i.uom_code,
    입수량: i.box_qty,
    로트관리: i.lot_yn ? 'Y' : 'N',
    유통기한관리: i.expiry_yn ? 'Y' : 'N',
    사용: i.is_active ? 'Y' : 'N',
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '품목')
  XLSX.writeFile(wb, `품목목록_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
