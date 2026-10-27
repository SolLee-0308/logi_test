import { cn } from '@/lib/utils'
import {
  APPROVAL_LABEL,
  ASN_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  type ApprovalStatus,
  type AsnStatus,
  type PlanStatus,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'

const TONE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
  REGISTERED: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  LOADED: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  RECEIVING: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  RECEIVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
}

// 입고예정·품목 승인 상태 공통 배지
export function StatusBadge({
  status,
  kind = 'plan',
  className,
}: {
  status: PlanStatus | ApprovalStatus | AsnStatus
  kind?: 'plan' | 'approval' | 'asn'
  className?: string
}) {
  const label =
    kind === 'plan'
      ? PLAN_STATUS_LABEL[status as PlanStatus]
      : kind === 'asn'
        ? ASN_STATUS_LABEL[status as AsnStatus]
        : APPROVAL_LABEL[status as ApprovalStatus]
  return (
    <Badge variant="secondary" className={cn(TONE[status], className)}>
      {label}
    </Badge>
  )
}
