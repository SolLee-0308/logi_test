import { addDays, format } from 'date-fns'

// 한국 시간 기준 날짜 문자열(yyyy-MM-dd)
export function todayKst(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const utcDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return format(addDays(utcDate, offsetDays), 'yyyy-MM-dd')
}

export function formatDateTime(value: string | null | undefined) {
  return value ? format(new Date(value), 'yyyy-MM-dd HH:mm') : ''
}

export function formatQty(value: number | null | undefined) {
  return value == null ? '' : Number(value).toLocaleString()
}
