import { Link } from 'react-router'
import { ClipboardCheck, Monitor, Truck, type LucideIcon } from 'lucide-react'

import { isShipperUser, useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

function Tile({
  to,
  icon: Icon,
  title,
  desc,
  disabled,
}: {
  to: string
  icon: LucideIcon
  title: string
  desc: string
  disabled?: boolean
}) {
  const body = (
    <div
      className={cn(
        'bg-card flex items-center gap-4 rounded-2xl border p-5 shadow-sm',
        disabled ? 'opacity-50' : 'active:bg-muted',
      )}
    >
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-xl">
        <Icon className="size-7" />
      </div>
      <div>
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-muted-foreground text-sm">{desc}</div>
      </div>
    </div>
  )
  return disabled ? body : <Link to={to}>{body}</Link>
}

export function PdaHomePage() {
  const { profile } = useAuth()
  const shipper = isShipperUser(profile)

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground px-1 text-sm">작업을 선택하세요.</p>
      {shipper ? (
        <Tile
          to="/pda/loading"
          icon={Truck}
          title="차량 상차 등록"
          desc="상차지시서 바코드 스캔 → 품목 스캔 → 수량"
        />
      ) : (
        <Tile
          to="/pda/receiving"
          icon={ClipboardCheck}
          title="입고 검수"
          desc="5단계에서 제공 예정"
          disabled
        />
      )}
      <Tile to="/" icon={Monitor} title="웹 화면으로" desc="대시보드·조회 화면" />
    </div>
  )
}
