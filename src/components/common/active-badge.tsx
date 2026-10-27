import { Badge } from '@/components/ui/badge'

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
      사용
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      미사용
    </Badge>
  )
}
