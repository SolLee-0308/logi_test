import type { FormEventHandler, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type FormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onSubmit: FormEventHandler<HTMLFormElement>
  isSubmitting?: boolean
  readOnly?: boolean
  extraActions?: ReactNode
  children: ReactNode
}

// 목록 화면의 우측 슬라이드 등록/수정 폼
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isSubmitting,
  readOnly,
  extraActions,
  children,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <fieldset disabled={readOnly} className="flex-1 space-y-5 overflow-y-auto p-4">
            {children}
          </fieldset>
          <SheetFooter className="flex-row border-t">
            {extraActions}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {readOnly ? '닫기' : '취소'}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '저장 중…' : '저장'}
                </Button>
              )}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
