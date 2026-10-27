import { useShippers } from '@/features/master/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// 목록 상단의 화주사 필터 ('all' = 전체)
export function ShipperFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { data } = useShippers()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="화주사" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">전체 화주사</SelectItem>
        {(data ?? []).map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.shipper_name} ({s.shipper_code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
