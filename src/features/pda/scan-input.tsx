import { useEffect, useRef, useState } from 'react'
import { Keyboard, ScanBarcode } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 바코드 스캐너(키보드 입력 방식) 입력칸: 항상 포커스를 유지하고 Enter 로 확정
export function ScanInput({
  placeholder,
  onScan,
  disabled,
  autoRefocus = true,
}: {
  placeholder: string
  onScan: (value: string) => void
  disabled?: boolean
  autoRefocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  // 스캐너 사용 시 화면 키보드를 숨기고, 직접 입력할 때만 켠다
  const [keyboard, setKeyboard] = useState(false)

  useEffect(() => {
    if (!disabled) ref.current?.focus()
  }, [disabled])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = value.trim()
        if (!v) return
        setValue('')
        onScan(v)
      }}
      className="relative"
    >
      <ScanBarcode className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2" />
      <Input
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          // 다른 입력 중이 아니면 스캔칸으로 포커스 복귀
          if (autoRefocus && !disabled) {
            setTimeout(() => {
              const active = document.activeElement
              if (!active || active === document.body) ref.current?.focus()
            }, 150)
          }
        }}
        placeholder={placeholder}
        inputMode={keyboard ? 'text' : 'none'}
        autoComplete="off"
        className="h-14 pr-12 pl-11 text-lg"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="키보드로 입력"
        className={cn('absolute top-1/2 right-1 -translate-y-1/2', keyboard && 'text-primary')}
        onClick={() => {
          setKeyboard((k) => !k)
          ref.current?.focus()
        }}
      >
        <Keyboard className="size-5" />
      </Button>
    </form>
  )
}
