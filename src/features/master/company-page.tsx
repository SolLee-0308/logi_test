import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImageIcon, ImageUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/lib/auth-context'
import { toErrorMessage } from '@/lib/errors'
import {
  CI_MAX_BYTES,
  companyAssetUrl,
  emptyToNull,
  masterKeys,
  removeCompanyAsset,
  uploadCompanyCi,
  useCompany,
  useSaveRow,
} from '@/features/master/api'
import { AddressSearchButton } from '@/components/common/address-search'
import { PageHeader } from '@/components/common/page-header'
import { TextField } from '@/components/common/form-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const optional = (re: RegExp, message: string) =>
  z.union([z.literal(''), z.string().regex(re, message)]).nullish()

const schema = z.object({
  // 기본정보
  company_name: z.string().trim().min(1, '상호를 입력하세요.').max(100),
  biz_no: optional(/^\d{3}-\d{2}-\d{5}$/, '000-00-00000 형식으로 입력하세요.'),
  corp_no: optional(/^\d{6}-\d{7}$/, '000000-0000000 형식으로 입력하세요.'),
  ceo_name: z.string().max(50).nullish(),
  established_date: z.string().nullish(),
  // 상세정보
  zip_code: optional(/^\d{5}$/, '우편번호는 숫자 5자리입니다.'),
  address: z.string().nullish(),
  address_detail: z.string().max(200).nullish(),
  tel: z.string().max(20).nullish(),
  fax: z.string().max(20).nullish(),
  email: z.union([z.literal(''), z.email('이메일 형식이 아닙니다.')]).nullish(),
})
type FormValues = z.infer<typeof schema>

// CI 이미지 변경 상태: 그대로 / 새 파일 선택 / 삭제
type CiChange = { kind: 'keep' } | { kind: 'new'; file: File } | { kind: 'remove' }

export function CompanyPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const { data, isLoading } = useCompany()
  const save = useSaveRow()
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const [ci, setCi] = useState<CiChange>({ kind: 'keep' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (data) form.reset(data)
  }, [data, form])

  const onSubmit = form.handleSubmit(async (values) => {
    const oldPath = data?.ci_image_path ?? null
    setSubmitting(true)
    try {
      // 1) 새 CI 파일이 있으면 먼저 올린다
      let newPath = ci.kind === 'remove' ? null : oldPath
      if (ci.kind === 'new') {
        try {
          newPath = await uploadCompanyCi(ci.file)
        } catch (e) {
          toast.error(`CI 이미지를 올리지 못했습니다. ${toErrorMessage(e)}`)
          return
        }
      }
      // 2) 회사정보에 경로와 함께 저장 (실패 알림은 useSaveRow 가 띄움)
      try {
        await save.mutateAsync({
          table: 'company',
          values: { ...emptyToNull(values), ci_image_path: newPath },
          match: { id: 1 },
          invalidate: masterKeys.company,
        })
      } catch {
        // 방금 올린 파일은 쓰이지 않으므로 지운다
        if (newPath && newPath !== oldPath) removeCompanyAsset(newPath).catch(() => {})
        return
      }
      setCi({ kind: 'keep' })
      // 3) 바뀐 이전 파일은 정리 (실패해도 저장 결과에는 영향 없음)
      if (oldPath && oldPath !== newPath) removeCompanyAsset(oldPath).catch(() => {})
    } finally {
      setSubmitting(false)
    }
  })

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="회사정보" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="회사정보"
        description="3PL 운영사 정보입니다. 상차지시서 등 출력물에 사용됩니다."
      />
      <form onSubmit={onSubmit}>
        <fieldset disabled={!isAdmin || submitting} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>기본정보</CardTitle>
              <CardDescription>사업자등록증 기준의 회사 정보입니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField control={form.control} name="company_name" label="상호" required />
              </div>
              <TextField
                control={form.control}
                name="biz_no"
                label="사업자등록번호"
                placeholder="000-00-00000"
              />
              <TextField
                control={form.control}
                name="corp_no"
                label="법인등록번호"
                placeholder="000000-0000000"
              />
              <TextField control={form.control} name="ceo_name" label="대표자" />
              <TextField
                control={form.control}
                name="established_date"
                label="설립일"
                type="date"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>상세정보</CardTitle>
              <CardDescription>주소, 연락처, 회사 CI 이미지입니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {/* 주소: 검색으로 우편번호·기본주소를 채우고 상세주소만 직접 입력 */}
              <div className="flex items-end gap-2 sm:col-span-2">
                <div className="w-36">
                  <TextField
                    control={form.control}
                    name="zip_code"
                    label="우편번호"
                    placeholder="00000"
                  />
                </div>
                <AddressSearchButton
                  disabled={!isAdmin}
                  onSelect={({ zipCode, address }) => {
                    form.setValue('zip_code', zipCode, { shouldDirty: true, shouldValidate: true })
                    form.setValue('address', address, { shouldDirty: true })
                    form.setFocus('address_detail')
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  control={form.control}
                  name="address"
                  label="기본주소"
                  placeholder="주소 검색을 누르세요"
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  control={form.control}
                  name="address_detail"
                  label="상세주소"
                  placeholder="동·층·호수 등"
                />
              </div>
              <TextField
                control={form.control}
                name="tel"
                label="전화번호"
                type="tel"
                placeholder="02-0000-0000"
              />
              <TextField
                control={form.control}
                name="fax"
                label="팩스번호"
                type="tel"
                placeholder="02-0000-0000"
              />
              <div className="sm:col-span-2">
                <TextField control={form.control} name="email" label="대표 이메일" type="email" />
              </div>
              <div className="sm:col-span-2">
                <CiImageField
                  savedPath={data?.ci_image_path ?? null}
                  change={ci}
                  onChange={setCi}
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? '저장 중…' : '저장'}
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  )
}

// 회사 CI 이미지: 미리보기 + 선택·삭제 (실제 업로드는 저장할 때)
function CiImageField({
  savedPath,
  change,
  onChange,
  disabled,
}: {
  savedPath: string | null
  change: CiChange
  onChange: (change: CiChange) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  // 새로 고른 파일은 브라우저 임시 URL로 미리보기
  const fileUrl = useMemo(
    () => (change.kind === 'new' ? URL.createObjectURL(change.file) : null),
    [change],
  )
  useEffect(() => () => void (fileUrl && URL.revokeObjectURL(fileUrl)), [fileUrl])

  const previewUrl =
    change.kind === 'new' ? fileUrl : change.kind === 'remove' ? null : companyAssetUrl(savedPath)

  const onPick = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('이미지 파일만 등록할 수 있습니다.')
    if (file.size > CI_MAX_BYTES) return toast.error('이미지는 2MB 이하만 등록할 수 있습니다.')
    onChange({ kind: 'new', file })
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">회사 CI 이미지</div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-muted/40 flex h-24 w-48 items-center justify-center overflow-hidden rounded-lg border">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="회사 CI"
              className="max-h-full max-w-full object-contain p-2"
            />
          ) : (
            <ImageIcon className="text-muted-foreground size-8" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImageUp />
              {previewUrl ? '변경' : '이미지 선택'}
            </Button>
            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(savedPath ? { kind: 'remove' } : { kind: 'keep' })}
              >
                <Trash2 />
                삭제
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            PNG·JPG·WEBP·SVG, 2MB 이하. 저장을 눌러야 반영됩니다.
            {change.kind !== 'keep' && <span className="text-amber-600"> (변경됨)</span>}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
