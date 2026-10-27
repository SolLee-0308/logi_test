import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Truck, XCircle } from 'lucide-react'

import { toErrorMessage } from '@/lib/errors'
import { startLoading } from '@/features/asn/api'
import { ScanInput } from '@/features/pda/scan-input'

// 상차 1단계: 상차지시서 바코드(ASN 번호) 스캔
export function PdaLoadingStartPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const start = useMutation({
    mutationFn: startLoading,
    onSuccess: (loadingId) => navigate(`/pda/loading/${loadingId}`),
    onError: (e) => setError(toErrorMessage(e)),
  })

  return (
    <div className="space-y-4">
      <div className="bg-card space-y-3 rounded-2xl border p-5 text-center shadow-sm">
        <div className="bg-primary/10 text-primary mx-auto flex size-16 items-center justify-center rounded-2xl">
          <Truck className="size-8" />
        </div>
        <h1 className="text-xl font-semibold">차량 상차 등록</h1>
        <p className="text-muted-foreground text-sm">
          상차지시서 상단의 바코드를 스캔하세요.
          <br />
          스캔이 안 되면 키보드 버튼을 눌러 ASN 번호를 입력합니다.
        </p>
      </div>
      <ScanInput
        placeholder="상차지시서 바코드 (AS-…)"
        disabled={start.isPending}
        onScan={(v) => {
          setError(null)
          start.mutate(v)
        }}
      />
      {start.isPending && <p className="text-muted-foreground text-center text-sm">확인 중…</p>}
      {error && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border p-3 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
