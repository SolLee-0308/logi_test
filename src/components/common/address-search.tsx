import { useCallback, useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { TextField } from '@/components/common/form-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// 카카오 우편번호 서비스 (API 키 불필요) — https://postcode.map.kakao.com/guide
const SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

type PostcodeData = {
  zonecode: string
  roadAddress: string
  jibunAddress: string
  autoJibunAddress: string
  userSelectedType: 'R' | 'J'
  bname: string
  buildingName: string
  apartment: 'Y' | 'N'
}

type PostcodeCtor = new (options: {
  oncomplete: (data: PostcodeData) => void
  width: string
  height: string
}) => { embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void }

declare global {
  interface Window {
    kakao?: { Postcode?: PostcodeCtor }
  }
}

export type AddressResult = { zipCode: string; address: string }

// 스크립트는 처음 검색할 때 한 번만 불러온다
let scriptPromise: Promise<PostcodeCtor> | null = null
function loadPostcode() {
  if (window.kakao?.Postcode) return Promise.resolve(window.kakao.Postcode)
  scriptPromise ??= new Promise<PostcodeCtor>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.kakao?.Postcode ? resolve(window.kakao.Postcode) : reject(new Error('load failed'))
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new Error('load failed'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

// 도로명 주소 + 참고항목(법정동, 건물명) — 카카오 가이드의 권장 조합
function toAddress(data: PostcodeData) {
  if (data.userSelectedType === 'J') return data.jibunAddress || data.autoJibunAddress
  const extras = [
    /[동로가]$/.test(data.bname) ? data.bname : '',
    data.apartment === 'Y' ? data.buildingName : '',
  ].filter(Boolean)
  return extras.length ? `${data.roadAddress} (${extras.join(', ')})` : data.roadAddress
}

// 주소 검색 버튼 + 검색 팝업
export function AddressSearchButton({
  onSelect,
  disabled,
}: {
  onSelect: (result: AddressResult) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 최신 onSelect 를 ref 로 들고 있어서, 화면이 다시 그려져도 검색창을 다시 붙이지 않는다
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // 팝업 안의 영역이 화면에 붙는 순간 검색창을 그 안에 한 번 넣는다
  const container = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    loadPostcode()
      .then((Postcode) =>
        new Postcode({
          oncomplete: (data) => {
            onSelectRef.current({ zipCode: data.zonecode, address: toAddress(data) })
            setOpen(false)
          },
          width: '100%',
          height: '100%',
        }).embed(el),
      )
      .catch(() =>
        setError('주소 검색 서비스를 불러오지 못했습니다. 네트워크를 확인하거나 직접 입력하세요.'),
      )
  }, [])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <MapPin />
        주소 검색
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>주소 검색</DialogTitle>
            <DialogDescription>도로명, 건물명, 지번으로 검색하세요.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <div ref={container} className="h-[460px] w-full overflow-hidden rounded-md border" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// 주소 입력 블록: 우편번호 + 주소 검색 + 기본주소 + 상세주소
// 폼에 zip_code / address / address_detail 필드가 있어야 한다 (회사정보·화주사 공통)
type AddressValues = {
  zip_code?: string | null
  address?: string | null
  address_detail?: string | null
}

export function AddressFields<T extends AddressValues & FieldValues>({
  form,
  disabled,
  className,
}: {
  form: UseFormReturn<T>
  disabled?: boolean
  className?: string
}) {
  // 필드 이름이 고정이라 내부에서는 주소 필드 타입으로만 다룬다
  const f = form as unknown as UseFormReturn<AddressValues>

  return (
    <div className={cn('grid gap-5', className)}>
      <div className="flex items-end gap-2">
        <div className="w-36">
          <TextField control={f.control} name="zip_code" label="우편번호" placeholder="00000" />
        </div>
        <AddressSearchButton
          disabled={disabled}
          onSelect={({ zipCode, address }) => {
            f.setValue('zip_code', zipCode, { shouldDirty: true, shouldValidate: true })
            f.setValue('address', address, { shouldDirty: true })
            f.setFocus('address_detail')
          }}
        />
      </div>
      <TextField
        control={f.control}
        name="address"
        label="기본주소"
        placeholder="주소 검색을 누르세요"
      />
      <TextField
        control={f.control}
        name="address_detail"
        label="상세주소"
        placeholder="동·층·호수 등"
      />
    </div>
  )
}
