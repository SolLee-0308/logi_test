import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Warehouse } from 'lucide-react'
import { z } from 'zod'

import { useAuth } from '@/lib/auth-context'
import { toErrorMessage } from '@/lib/errors'
import { TextField } from '@/components/common/form-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  email: z.email('이메일 형식으로 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (session) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(toErrorMessage(e))
    }
  })

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-2 flex size-11 items-center justify-center rounded-xl">
            <Warehouse className="size-5" />
          </div>
          <CardTitle className="text-xl">LOGI 입고관리</CardTitle>
          <CardDescription>발급받은 계정으로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <TextField control={form.control} name="email" label="이메일" type="email" />
            <TextField control={form.control} name="password" label="비밀번호" type="password" />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? '로그인 중…' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
