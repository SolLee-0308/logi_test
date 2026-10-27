import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { toErrorMessage } from '@/lib/errors'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import { ROLE_LABEL, USER_TYPE_LABEL, type Profile, type Role, type UserType } from '@/lib/types'
import { useShippers } from '@/features/master/api'
import { ActiveBadge } from '@/components/common/active-badge'
import { DataTable } from '@/components/common/data-table'
import type { DataColumn } from '@/components/common/data-table-features'
import { FormSheet } from '@/components/common/form-sheet'
import {
  SelectField,
  ShipperSelectField,
  SwitchField,
  TextField,
} from '@/components/common/form-fields'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ROLES_BY_TYPE: Record<UserType, Role[]> = {
  INTERNAL: ['ADMIN', 'OPERATOR', 'WORKER'],
  SHIPPER: ['SHIPPER_USER'],
}

const schema = z
  .object({
    login_id: z.email('이메일 형식으로 입력하세요.'),
    password: z.string().optional(),
    user_name: z.string().trim().min(1, '이름을 입력하세요.').max(50),
    user_type: z.enum(['INTERNAL', 'SHIPPER']),
    role: z.enum(['ADMIN', 'OPERATOR', 'WORKER', 'SHIPPER_USER'], { error: '권한을 선택하세요.' }),
    shipper_id: z.string().nullish(),
    tel: z.string().max(20).nullish(),
    is_active: z.boolean(),
  })
  .refine((v) => ROLES_BY_TYPE[v.user_type].includes(v.role), {
    path: ['role'],
    message: '사용자 구분에 맞는 권한을 선택하세요.',
  })
  .refine((v) => v.user_type === 'INTERNAL' || Boolean(v.shipper_id), {
    path: ['shipper_id'],
    message: '화주 사용자는 소속 화주사가 필요합니다.',
  })
type FormValues = z.infer<typeof schema>

async function invokeAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase!.functions.invoke('admin-users', { body })
  if (error) {
    // Edge Function 이 돌려준 오류 본문을 우선 사용
    const ctx = (error as { context?: Response }).context
    const detail = ctx ? await ctx.json().catch(() => null) : null
    throw detail ?? error
  }
  return data
}

const useProfiles = () =>
  useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase!.from('profiles').select('*').order('login_id')
      if (error) throw error
      return data as Profile[]
    },
  })

export function UsersPage() {
  const { data: profiles, isLoading } = useProfiles()
  const { data: shippers } = useShippers()
  const [tab, setTab] = useState<UserType>('INTERNAL')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [open, setOpen] = useState(false)
  const [pwTarget, setPwTarget] = useState<Profile | null>(null)

  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const userType = useWatch({ control: form.control, name: 'user_type' })
  const pwForm = useForm<{ password: string }>({
    resolver: zodResolver(z.object({ password: z.string().min(8, '8자 이상 입력하세요.') })),
  })

  const shipperMap = useMemo(() => new Map((shippers ?? []).map((s) => [s.id, s])), [shippers])
  const rows = useMemo(() => profiles?.filter((p) => p.user_type === tab), [profiles, tab])

  const columns = useMemo<DataColumn<Profile>[]>(
    () => [
      { accessorKey: 'login_id', header: '로그인 ID' },
      { accessorKey: 'user_name', header: '이름' },
      {
        id: 'role',
        header: '권한',
        accessorFn: (r) => ROLE_LABEL[r.role],
        cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
      },
      ...(tab === 'SHIPPER'
        ? [
            {
              id: 'shipper',
              header: '소속 화주사',
              accessorFn: (r: Profile) => shipperMap.get(r.shipper_id ?? '')?.shipper_name ?? '',
            },
          ]
        : []),
      { accessorKey: 'tel', header: '연락처' },
      {
        accessorKey: 'is_active',
        header: '사용',
        cell: ({ getValue }) => <ActiveBadge active={getValue()} />,
      },
    ],
    [tab, shipperMap],
  )

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? invokeAdminUsers({ action: 'update', id: editing.id, ...values })
        : invokeAdminUsers({ action: 'create', email: values.login_id, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('저장했습니다.')
      setOpen(false)
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })

  const resetPassword = useMutation({
    mutationFn: (password: string) =>
      invokeAdminUsers({ action: 'reset_password', id: pwTarget!.id, password }),
    onSuccess: () => {
      toast.success('비밀번호를 초기화했습니다.')
      setPwTarget(null)
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })

  const openForm = (row: Profile | null) => {
    setEditing(row)
    form.reset(
      row ?? {
        login_id: '',
        password: '',
        user_name: '',
        user_type: tab,
        role: tab === 'SHIPPER' ? 'SHIPPER_USER' : 'OPERATOR',
        is_active: true,
      },
    )
    setOpen(true)
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!editing && (values.password ?? '').length < 8) {
      form.setError('password', { message: '초기 비밀번호를 8자 이상 입력하세요.' })
      return
    }
    save.mutate(values)
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="사용자"
        description="로그인 계정입니다. 내부 사용자(3PL)와 화주 사용자로 구분합니다."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus /> 사용자 등록
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as UserType)}>
        <TabsList>
          <TabsTrigger value="INTERNAL">내부 사용자</TabsTrigger>
          <TabsTrigger value="SHIPPER">화주 사용자</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="로그인 ID, 이름 검색"
        onRowClick={openForm}
      />

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? '사용자 수정' : '사용자 등록'}
        onSubmit={onSubmit}
        isSubmitting={save.isPending}
        extraActions={
          editing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                pwForm.reset({ password: '' })
                setPwTarget(editing)
              }}
            >
              <KeyRound /> 비밀번호 초기화
            </Button>
          )
        }
      >
        <TextField
          control={form.control}
          name="login_id"
          label="로그인 ID (이메일)"
          type="email"
          required
          disabled={Boolean(editing)}
          description={editing ? '로그인 ID는 변경할 수 없습니다.' : undefined}
        />
        {!editing && (
          <TextField
            control={form.control}
            name="password"
            label="초기 비밀번호"
            type="password"
            required
            description="8자 이상"
          />
        )}
        <TextField control={form.control} name="user_name" label="이름" required />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="user_type"
            label="사용자 구분"
            required
            options={(['INTERNAL', 'SHIPPER'] as const).map((t) => ({
              value: t,
              label: USER_TYPE_LABEL[t],
            }))}
          />
          <SelectField
            control={form.control}
            name="role"
            label="권한"
            required
            options={ROLES_BY_TYPE[userType ?? 'INTERNAL'].map((r) => ({
              value: r,
              label: ROLE_LABEL[r],
            }))}
          />
        </div>
        {userType === 'SHIPPER' && (
          <ShipperSelectField
            control={form.control}
            name="shipper_id"
            label="소속 화주사"
            required
            activeOnly
          />
        )}
        <TextField control={form.control} name="tel" label="연락처" type="tel" />
        <SwitchField
          control={form.control}
          name="is_active"
          label="사용"
          description="미사용으로 바꾸면 로그인이 차단됩니다."
        />
      </FormSheet>

      <FormSheet
        open={Boolean(pwTarget)}
        onOpenChange={(o) => !o && setPwTarget(null)}
        title="비밀번호 초기화"
        description={pwTarget?.login_id}
        onSubmit={pwForm.handleSubmit((v) => resetPassword.mutate(v.password))}
        isSubmitting={resetPassword.isPending}
      >
        <TextField
          control={pwForm.control}
          name="password"
          label="새 비밀번호"
          type="password"
          required
          description="8자 이상"
        />
      </FormSheet>
    </div>
  )
}
