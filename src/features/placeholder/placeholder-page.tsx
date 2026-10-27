import { Construction } from 'lucide-react'
import { useLocation } from 'react-router'

import { allNavItems } from '@/app/navigation'

export function PlaceholderPage() {
  const { pathname } = useLocation()
  const item = allNavItems.find((i) => i.url === pathname)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
      <Construction className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{item?.title ?? '페이지를 찾을 수 없습니다'}</h1>
      <p className="text-sm text-muted-foreground">
        {item ? '업무 프로세스 정의 후 구현 예정입니다.' : '주소를 다시 확인해 주세요.'}
      </p>
    </div>
  )
}
