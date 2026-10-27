import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAuth } from '@/lib/auth-context'
import { emptyToNull, masterKeys, useCompany, useSaveRow } from '@/features/master/api'
import { PageHeader } from '@/components/common/page-header'
import { TextField } from '@/components/common/form-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  company_name: z.string().trim().min(1, '상호를 입력하세요.').max(100),
  biz_no: z
    .string()
    .regex(/^(\d{3}-\d{2}-\d{5})?$/, '000-00-00000 형식으로 입력하세요.')
    .nullish(),
  ceo_name: z.string().max(50).nullish(),
  address: z.string().nullish(),
  tel: z.string().max(20).nullish(),
  email: z.union([z.literal(''), z.email('이메일 형식이 아닙니다.')]).nullish(),
})
type FormValues = z.infer<typeof schema>

export function CompanyPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const { data, isLoading } = useCompany()
  const save = useSaveRow()
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data) form.reset(data)
  }, [data, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate({
      table: 'company',
      values: emptyToNull(values),
      match: { id: 1 },
      invalidate: masterKeys.company,
    }),
  )

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="회사정보"
        description="3PL 운영사 정보입니다. 상차지시서 등 출력물에 사용됩니다."
      />
      <Card>
        {isLoading ? (
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        ) : (
          <form onSubmit={onSubmit}>
            <fieldset disabled={!isAdmin}>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <TextField control={form.control} name="company_name" label="상호" required />
                <TextField
                  control={form.control}
                  name="biz_no"
                  label="사업자등록번호"
                  placeholder="000-00-00000"
                />
                <TextField control={form.control} name="ceo_name" label="대표자" />
                <TextField control={form.control} name="tel" label="대표전화" type="tel" />
                <div className="sm:col-span-2">
                  <TextField control={form.control} name="address" label="주소" />
                </div>
                <TextField control={form.control} name="email" label="대표 이메일" type="email" />
              </CardContent>
              {isAdmin && (
                <CardFooter className="mt-6 justify-end border-t">
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? '저장 중…' : '저장'}
                  </Button>
                </CardFooter>
              )}
            </fieldset>
          </form>
        )}
      </Card>
    </div>
  )
}
