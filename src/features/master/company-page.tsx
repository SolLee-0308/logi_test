import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImageIcon, ImageUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/lib/auth-context'
import { toErrorMessage } from '@/lib/errors'
import { formatBizNo, formatCorpNo, formatPhone, PHONE_REGEX } from '@/lib/format'
import { cn } from '@/lib/utils'
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
import { AddressFields } from '@/components/common/address-search'
import { PageHeader } from '@/components/common/page-header'
import { TextField } from '@/components/common/form-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const optional = (re: RegExp, message: string) =>
  z.union([z.literal(''), z.string().regex(re, message)]).nullish()

// 필수 문자열 (DB 값이 null 이어도 같은 안내 문구를 보여준다)
const required = (message: string) => z.string(message).trim().min(1, message)

const schema = z.object({
  // 기본정보 (상호·사업자등록번호·대표자 필수)
  company_name: required('상호를 입력하세요.').max(100),
  biz_no: required('사업자등록번호를 입력하세요.').regex(
    /^\d{3}-\d{2}-\d{5}$/,
    '사업자등록번호 10자리를 입력하세요.',
  ),
  corp_no: optional(/^\d{6}-\d{7}$/, '법인등록번호 13자리를 입력하세요.'),
  ceo_name: required('대표자를 입력하세요.').max(50),
  established_date: z.string().nullish(),
  // 상세정보
  zip_code: optional(/^\d{5}$/, '우편번호는 숫자 5자리입니다.'),
  address: z.string().nullish(),
  address_detail: z.string().max(200).nullish(),
  tel: optional(PHONE_REGEX, '전화번호를 끝까지 입력하세요.'),
  fax: optional(PHONE_REGEX, '팩스번호를 끝까지 입력하세요.'),
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
    // 필수 항목이 아직 비어 있으면(null) 빈 문자열로 채워 입력 안내가 보이게 한다
    if (data) form.reset({ ...data, biz_no: data.biz_no ?? '', ceo_name: data.ceo_name ?? '' })
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
                required
                placeholder="숫자 10자리"
                format={formatBizNo}
              />
              <TextField
                control={form.control}
                name="corp_no"
                label="법인등록번호"
                placeholder="숫자 13자리"
                format={formatCorpNo}
              />
              <TextField control={form.control} name="ceo_name" label="대표자" required />
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
              <AddressFields form={form} disabled={!isAdmin} className="sm:col-span-2" />
              <TextField
                control={form.control}
                name="tel"
                label="전화번호"
                type="tel"
                placeholder="숫자만 입력"
                format={formatPhone}
              />
              <TextField
                control={form.control}
                name="fax"
                label="팩스번호"
                type="tel"
                placeholder="숫자만 입력"
                format={formatPhone}
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

const CI_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

// 회사 CI 이미지: 큰 미리보기 영역에 드래그앤드롭 또는 클릭으로 선택 (실제 업로드는 저장할 때)
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
  // 파일을 영역 위로 끌고 왔는지 (테두리 강조용)
  const [dragging, setDragging] = useState(false)

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
    if (!CI_TYPES.includes(file.type))
      return toast.error('PNG, JPG, WEBP, SVG 이미지만 등록할 수 있습니다.')
    if (file.size > CI_MAX_BYTES) return toast.error('이미지는 2MB 이하만 등록할 수 있습니다.')
    onChange({ kind: 'new', file })
  }

  const openPicker = () => !disabled && inputRef.current?.click()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          회사 CI 이미지
          {change.kind !== 'keep' && (
            <span className="ml-2 text-xs font-normal text-amber-600">
              변경됨 · 저장을 눌러야 반영됩니다
            </span>
          )}
        </div>
        {previewUrl && !disabled && (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={openPicker}>
              <ImageUp />
              변경
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(savedPath ? { kind: 'remove' } : { kind: 'keep' })}
            >
              <Trash2 />
              삭제
            </Button>
          </div>
        )}
      </div>

      {/* 드롭 영역: 클릭하거나 이미지 파일을 끌어다 놓는다 */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="회사 CI 이미지 선택"
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => {
          // 기본 동작(브라우저가 파일을 여는 것)을 막아야 drop 이벤트가 온다
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) onPick(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'bg-muted/30 relative flex h-56 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors',
          disabled ? 'cursor-default' : 'hover:bg-muted/50 cursor-pointer',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="회사 CI"
            className="max-h-full max-w-full object-contain p-6"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-sm">
            <ImageIcon className="size-10" />
            <div>
              <span className="text-foreground font-medium">이미지를 끌어다 놓거나 클릭</span>
              해서 선택하세요
            </div>
            <div className="text-xs">PNG·JPG·WEBP·SVG, 2MB 이하</div>
          </div>
        )}
        {dragging && (
          <div className="bg-primary/10 text-primary absolute inset-0 flex items-center justify-center text-sm font-medium">
            여기에 놓으세요
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={CI_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
