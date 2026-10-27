import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import JsBarcode from 'jsbarcode'
import { Printer } from 'lucide-react'

import { formatDateTime, formatQty } from '@/lib/date'
import { useCodeMap, useCompany } from '@/features/master/api'
import { useAsn } from '@/features/asn/api'
import { Button } from '@/components/ui/button'

function Barcode({ value, height = 56 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width: 2,
        fontSize: 14,
        margin: 0,
      })
    }
  }, [value, height])
  return <svg ref={ref} />
}

// 상차지시서 (A4 출력용). 거래명세서를 대신하며, 바코드 값은 ASN 번호다.
export function AsnPrintPage() {
  const { id } = useParams()
  const { data, isLoading } = useAsn(id)
  const { data: company } = useCompany()
  const uomMap = useCodeMap('UOM')
  const vehicleTypeMap = useCodeMap('VEHICLE_TYPE')
  // 출력 시각은 화면을 연 시점으로 고정
  const [printedAt] = useState(() => formatDateTime(new Date().toISOString()))

  if (isLoading) return <p className="p-8 text-sm">불러오는 중…</p>
  const asn = data?.asn
  if (!asn) return <p className="p-8 text-sm">ASN을 찾을 수 없습니다.</p>

  return (
    <div className="min-h-svh bg-neutral-100 py-6 text-black print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> 인쇄
        </Button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">상 차 지 시 서</h1>
            <p className="mt-1 text-xs text-neutral-600">
              거래명세서 대용 · 입고 검수 시 이 바코드를 스캔합니다
            </p>
          </div>
          <div className="text-right">
            <Barcode value={asn.asn_no} />
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 text-sm">
          <dl className="grid grid-cols-[88px_1fr] gap-y-1.5">
            <dt className="text-neutral-500">ASN 번호</dt>
            <dd className="font-mono font-semibold">{asn.asn_no}</dd>
            <dt className="text-neutral-500">입고일자</dt>
            <dd className="font-semibold">{asn.asn_date}</dd>
            <dt className="text-neutral-500">화주사</dt>
            <dd>
              {asn.shipper_name} ({asn.shipper_code})
            </dd>
            <dt className="text-neutral-500">출력일시</dt>
            <dd>{printedAt}</dd>
          </dl>
          <dl className="grid grid-cols-[88px_1fr] gap-y-1.5">
            <dt className="text-neutral-500">차량번호</dt>
            <dd className="text-base font-bold">{asn.vehicle_no}</dd>
            <dt className="text-neutral-500">차종·톤수</dt>
            <dd>
              {[
                asn.vehicle_type_code && vehicleTypeMap.get(asn.vehicle_type_code),
                asn.tonnage && `${asn.tonnage}톤`,
              ]
                .filter(Boolean)
                .join(' · ') || '-'}
            </dd>
            <dt className="text-neutral-500">기사</dt>
            <dd>{[asn.driver_name, asn.driver_tel].filter(Boolean).join(' · ') || '-'}</dd>
            <dt className="text-neutral-500">입고센터</dt>
            <dd>
              {company?.company_name ? `${company.company_name} ` : ''}
              {asn.center_name}
              {asn.center_address && (
                <span className="block text-xs text-neutral-500">{asn.center_address}</span>
              )}
            </dd>
          </dl>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-black bg-neutral-100 text-left">
              <th className="w-8 px-2 py-1.5">No</th>
              <th className="px-2 py-1.5">화주 품목코드</th>
              <th className="px-2 py-1.5">품명 / 규격</th>
              <th className="px-2 py-1.5">바코드</th>
              <th className="w-12 px-2 py-1.5">단위</th>
              <th className="w-20 px-2 py-1.5 text-right">지시수량</th>
              <th className="w-20 px-2 py-1.5 text-right">확인</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.id} className="break-inside-avoid border-b border-neutral-300">
                <td className="px-2 py-1.5">{l.line_no}</td>
                <td className="px-2 py-1.5 font-mono">{l.shipper_item_code}</td>
                <td className="px-2 py-1.5">
                  {l.item_name}
                  {l.spec && <span className="text-neutral-500"> / {l.spec}</span>}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs">{l.barcode}</td>
                <td className="px-2 py-1.5">{uomMap.get(l.uom_code) ?? l.uom_code}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                  {formatQty(l.order_qty)}
                </td>
                <td className="px-2 py-1.5" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-semibold">
              <td className="px-2 py-1.5" colSpan={5}>
                합계 ({data.lines.length}품목)
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatQty(asn.total_order_qty)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        {asn.remark && <p className="mt-4 text-sm">비고: {asn.remark}</p>}
      </article>
    </div>
  )
}
