'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

// 오류 알림은 읽을 시간이 더 필요해 기본 8초 표시 (성공 등은 Toaster 기본 4초).
// sonner 는 유형별 기본 시간을 지원하지 않아 toast.error 를 한 번 감싼다. 호출 시 duration 을 주면 그 값이 우선.
const ERROR_DURATION = 8000
const showError = toast.error
toast.error = (message, data) => showError(message, { duration: ERROR_DURATION, ...data })

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
