import type { Code, Item, Shipper } from '@/lib/types'

// 엑셀 양식 열 (순서 = 양식 순서). 업로드는 첫 시트의 첫 행을 열 제목으로 읽는다.
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

// 작성안내 시트: 열별 필수 여부·형식·예시
const GUIDE: [string, string, string, string][] = [
  ['화주코드', '필수', '등록된 화주사의 화주코드 (참고코드 시트 참조)', 'SHA'],
  [
    '화주품목코드',
    '필수',
    '화주사에서 쓰는 품목코드. 같은 화주 안에서 중복 불가, 50자 이내',
    'P-001',
  ],
  ['품명', '필수', '200자 이내', '샘플 품목'],
  ['규격', '선택', '200자 이내', '500ml'],
  ['바코드', '선택', 'PDA 스캔용. 같은 화주 안에서 중복 불가, 50자 이내', '8801234567890'],
  ['단위', '선택', '공통코드 UOM의 코드 (참고코드 시트 참조). 비우면 EA', 'EA'],
  ['입수량', '선택', '1 이상 정수', '24'],
  ['로트관리(Y/N)', '선택', 'Y면 입고 검수 시 로트번호 필수. 비우면 N', 'N'],
  ['유통기한관리(Y/N)', '선택', 'Y면 입고 검수 시 유통기한 필수. 비우면 N', 'Y'],
]

// 목록 다운로드 열 (품목이 0건이어도 제목 행은 항상 출력)
const LIST_HEADERS = [
  '화주코드',
  '화주명',
  '내부코드',
  '화주품목코드',
  '품명',
  '규격',
  '바코드',
  '단위',
  '입수량',
  '로트관리',
  '유통기한관리',
  '사용',
] as const

export async function loadXlsx() {
  return import('xlsx')
}

type XlsxModule = Awaited<ReturnType<typeof loadXlsx>>

// 2차원 배열로 시트를 만들고 열 너비를 내용 길이에 맞춘다
function sheet(XLSX: XlsxModule, rows: (string | number | null | undefined)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const widths = rows[0].map((_, col) =>
    Math.min(60, Math.max(8, ...rows.map((r) => String(r[col] ?? '').length * 2))),
  )
  ws['!cols'] = widths.map((wch) => ({ wch }))
  return ws
}

const today = () => new Date().toISOString().slice(0, 10)

export async function downloadTemplate(shippers: Shipper[], uoms: Code[]) {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    sheet(XLSX, [
      [...HEADERS],
      [
        'SHA',
        'P-001',
        '샘플 품목 (이 행은 지우고 작성)',
        '500ml',
        '8801234567890',
        'EA',
        24,
        'N',
        'Y',
      ],
    ]),
    '품목',
  )
  XLSX.utils.book_append_sheet(
    wb,
    sheet(XLSX, [['열 이름', '필수', '입력 규칙', '예시'], ...GUIDE]),
    '작성안내',
  )
  const activeShippers = shippers.filter((s) => s.is_active)
  const activeUoms = uoms.filter((u) => u.is_active)
  const refRows = Array.from(
    { length: Math.max(activeShippers.length, activeUoms.length) },
    (_, i) => [
      activeShippers[i]?.shipper_code,
      activeShippers[i]?.shipper_name,
      null,
      activeUoms[i]?.code,
      activeUoms[i]?.code_name,
    ],
  )
  XLSX.utils.book_append_sheet(
    wb,
    sheet(XLSX, [['화주코드', '화주명', null, '단위코드', '단위명'], ...refRows]),
    '참고코드',
  )
  XLSX.writeFile(wb, '품목_일괄등록_양식.xlsx')
}

export async function downloadItems(
  items: Item[],
  shipperMap: Map<string, Shipper>,
  uomMap: Map<string, string>,
) {
  const XLSX = await loadXlsx()
  const rows = items.map((i) => [
    shipperMap.get(i.shipper_id)?.shipper_code,
    shipperMap.get(i.shipper_id)?.shipper_name,
    i.internal_code,
    i.shipper_item_code,
    i.item_name,
    i.spec,
    i.barcode,
    uomMap.get(i.uom_code) ?? i.uom_code,
    i.box_qty,
    i.lot_yn ? 'Y' : 'N',
    i.expiry_yn ? 'Y' : 'N',
    i.is_active ? 'Y' : 'N',
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, [[...LIST_HEADERS], ...rows]), '품목')
  XLSX.writeFile(wb, `품목목록_${today()}.xlsx`)
}
