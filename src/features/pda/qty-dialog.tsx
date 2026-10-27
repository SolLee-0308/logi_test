import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

// PDA 수량 입력: 큰 버튼과 숫자 입력. initial 로 기본값 지정
export function QtyDialog({
  open,
  title,
  description,
  initial,
  min = 1,
  confirmLabel = '확인',
  onConfirm,
  onClose,
  pending,
}: {
  open: boolean
  title: string
  description?: string
  initial: number
  min?: number
  confirmLabel?: string
  onConfirm: (qty: number) => void
  onClose: () => void
  pending?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        {open && (
          <QtyBody
            title={title}
            description={description}
            initial={initial}
            min={min}
            confirmLabel={confirmLabel}
            onConfirm={onConfirm}
            onClose={onClose}
            pending={pending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function QtyBody({
  title,
  description,
  initial,
  min,
  confirmLabel,
  onConfirm,
  onClose,
  pending,
}: {
  title: string
  description?: string
  initial: number
  min: number
  confirmLabel: string
  onConfirm: (qty: number) => void
  onClose: () => void
  pending?: boolean
}) {
  const [qty, setQty] = useState<number | ''>(initial)
  const valid = qty !== '' && qty >= min

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onConfirm(Number(qty))
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle className="text-lg">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="size-14"
          onClick={() => setQty((q) => Math.max(min, Number(q || 0) - 1))}
          aria-label="1 감소"
        >
          <Minus className="size-6" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          autoFocus
          onFocus={(e) => e.target.select()}
          value={qty}
          min={min}
          onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
          className="h-14 flex-1 text-center text-2xl font-semibold tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          className="size-14"
          onClick={() => setQty((q) => Number(q || 0) + 1)}
          aria-label="1 증가"
        >
          <Plus className="size-6" />
        </Button>
      </div>
      <DialogFooter className="flex-row gap-2">
        <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={!valid || pending}>
          {pending ? '처리 중…' : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
