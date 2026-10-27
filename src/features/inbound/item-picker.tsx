import { useState } from 'react'
import { Plus } from 'lucide-react'

import type { Item } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// 화주사의 승인된 품목을 코드·품명·바코드로 찾아 추가
export function ItemPicker({
  items,
  excludeIds,
  onSelect,
  disabled,
}: {
  items: Item[]
  excludeIds: Set<string>
  onSelect: (item: Item) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const candidates = items.filter((i) => !excludeIds.has(i.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Plus /> 품목 추가
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,480px)] p-0" align="start">
        <Command>
          <CommandInput placeholder="화주 품목코드, 품명, 바코드로 검색" />
          <CommandList>
            <CommandEmpty>
              {items.length === 0 ? '이 화주사에 승인된 품목이 없습니다.' : '검색 결과가 없습니다.'}
            </CommandEmpty>
            <CommandGroup>
              {candidates.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.shipper_item_code} ${item.item_name} ${item.barcode ?? ''} ${item.internal_code}`}
                  onSelect={() => {
                    onSelect(item)
                    setOpen(false)
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{item.item_name}</span>
                    <span className="text-muted-foreground truncate font-mono text-xs">
                      {item.shipper_item_code} · {item.internal_code}
                      {item.spec ? ` · ${item.spec}` : ''}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
