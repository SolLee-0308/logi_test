import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// 대시보드 요약 카드 (누르면 해당 화면으로 이동)
export function KpiCard({
  title,
  value,
  icon: Icon,
  to,
  tone,
  sub,
}: {
  title: string
  value: number | undefined
  icon: LucideIcon
  to: string
  tone?: string
  sub?: ReactNode
}) {
  return (
    <Link to={to}>
      <Card className="hover:bg-muted/40 h-full transition-colors">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <Icon className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          {value === undefined ? (
            <Skeleton className="h-9 w-16" />
          ) : (
            <p className={`text-3xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
          )}
          {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}
