import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAuth } from '@/lib/auth-context'
import { emptyToNull, masterKeys, useDefaultCenter, useSaveRow } from '@/features/master/api'
import { PageHeader } from '@/components/common/page-header'
import { TextField } from '@/components/common/form-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  center_name: z.string().trim().min(1, '센터명을 입력하세요.').max(100),
  address: z.string().nullish(),
  tel: z.string().max(20).nullish(),
})
type FormValues = z.infer<typeof schema>

export function CenterPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const { data, isLoading } = useDefaultCenter()
  const save = useSaveRow()
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data) form.reset(data)
  }, [data, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate({
      table: 'centers',
      values: emptyToNull(values),
      match: { id: data!.id },
      invalidate: masterKeys.center,
    }),
  )

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="센터정보"
        description="입고를 처리하는 3PL 센터입니다. 현재는 기본 센터 1개로 운영합니다."
      />
      <Card>
        {isLoading ? (
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        ) : !data ? (
          <CardContent className="text-muted-foreground text-sm">
            기본 센터가 없습니다. 초기 데이터를 확인하세요.
          </CardContent>
        ) : (
          <form onSubmit={onSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-sm">{data.center_code}</span>
                <Badge>기본 센터</Badge>
              </CardTitle>
            </CardHeader>
            <fieldset disabled={!isAdmin}>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <TextField control={form.control} name="center_name" label="센터명" required />
                <TextField control={form.control} name="tel" label="전화번호" type="tel" />
                <div className="sm:col-span-2">
                  <TextField control={form.control} name="address" label="주소" />
                </div>
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
