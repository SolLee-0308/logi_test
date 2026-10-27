import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Pencil, Plus } from 'lucide-react'
import { z } from 'zod'

import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import type { Code, CodeGroup } from '@/lib/types'
import { emptyToNull, masterKeys, useCodeGroups, useCodes, useSaveRow } from '@/features/master/api'
import { ActiveBadge } from '@/components/common/active-badge'
import { DataTable } from '@/components/common/data-table'
import type { DataColumn } from '@/components/common/data-table-features'
import { FormSheet } from '@/components/common/form-sheet'
import { SwitchField, TextField, TextareaField } from '@/components/common/form-fields'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const groupSchema = z.object({
  group_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      '영문 대문자로 시작하고 영문 대문자, 숫자, _ 만 사용할 수 있습니다.',
    )
    .max(30),
  group_name: z.string().trim().min(1, '유형명을 입력하세요.').max(100),
  description: z.string().nullish(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
})
type GroupValues = z.infer<typeof groupSchema>

const codeSchema = z.object({
  code: z.string().trim().min(1, '코드를 입력하세요.').max(30),
  code_name: z.string().trim().min(1, '코드명을 입력하세요.').max(100),
  sort_order: z.number().int(),
  attr1: z.string().max(100).nullish(),
  attr2: z.string().max(100).nullish(),
  attr3: z.string().max(100).nullish(),
  is_active: z.boolean(),
})
type CodeValues = z.infer<typeof codeSchema>

const codeColumns: DataColumn<Code>[] = [
  {
    accessorKey: 'code',
    header: '코드',
    cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
  },
  { accessorKey: 'code_name', header: '코드명' },
  { accessorKey: 'sort_order', header: '정렬' },
  { accessorKey: 'attr1', header: '속성1' },
  { accessorKey: 'attr2', header: '속성2' },
  { accessorKey: 'attr3', header: '속성3' },
  {
    accessorKey: 'is_active',
    header: '사용',
    cell: ({ getValue }) => <ActiveBadge active={getValue()} />,
  },
]

export function CodesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const { data: groups, isLoading: groupsLoading } = useCodeGroups()
  const [selected, setSelected] = useState<string | null>(null)
  const groupCode = selected ?? groups?.[0]?.group_code
  const { data: codes, isLoading: codesLoading } = useCodes(groupCode)
  const group = useMemo(() => groups?.find((g) => g.group_code === groupCode), [groups, groupCode])
  const save = useSaveRow()

  // 유형코드 폼
  const [groupEditing, setGroupEditing] = useState<CodeGroup | null>(null)
  const [groupOpen, setGroupOpen] = useState(false)
  const groupForm = useForm<GroupValues>({ resolver: zodResolver(groupSchema) })
  const openGroup = (row: CodeGroup | null) => {
    setGroupEditing(row)
    groupForm.reset(
      row ?? {
        group_code: '',
        group_name: '',
        sort_order: (groups?.length ?? 0) * 10 + 10,
        is_active: true,
      },
    )
    setGroupOpen(true)
  }
  const submitGroup = groupForm.handleSubmit((values) =>
    save.mutate(
      {
        table: 'code_groups',
        values: emptyToNull(values),
        match: groupEditing ? { group_code: groupEditing.group_code } : undefined,
        invalidate: masterKeys.codeGroups,
      },
      {
        onSuccess: () => {
          setGroupOpen(false)
          setSelected(values.group_code)
        },
      },
    ),
  )

  // 공통코드 폼
  const [codeEditing, setCodeEditing] = useState<Code | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const codeForm = useForm<CodeValues>({ resolver: zodResolver(codeSchema) })
  const openCode = (row: Code | null) => {
    setCodeEditing(row)
    codeForm.reset(
      row ?? {
        code: '',
        code_name: '',
        sort_order: (codes?.length ?? 0) * 10 + 10,
        is_active: true,
      },
    )
    setCodeOpen(true)
  }
  const submitCode = codeForm.handleSubmit((values) =>
    save.mutate(
      {
        table: 'codes',
        values: emptyToNull({ ...values, group_code: groupCode }),
        match: codeEditing
          ? { group_code: codeEditing.group_code, code: codeEditing.code }
          : undefined,
        invalidate: ['codes'],
      },
      { onSuccess: () => setCodeOpen(false) },
    ),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="공통코드"
        description="유형코드(그룹) 아래에 공통코드를 두는 2단계 구조입니다."
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>유형코드</CardTitle>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => openGroup(null)}>
                <Plus /> 추가
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            {groupsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              : groups?.map((g) => (
                  <div
                    key={g.group_code}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(g.group_code)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(g.group_code)}
                    className={cn(
                      'group hover:bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                      g.group_code === groupCode && 'bg-muted font-medium',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{g.group_name}</div>
                      <div className="text-muted-foreground font-mono text-xs">{g.group_code}</div>
                    </div>
                    {g.is_system && (
                      <Lock className="text-muted-foreground size-3.5" aria-label="시스템 코드" />
                    )}
                    {!g.is_active && <Badge variant="outline">미사용</Badge>}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        openGroup(g)
                      }}
                      aria-label="유형코드 수정"
                    >
                      <Pencil />
                    </Button>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {group ? `${group.group_name} (${group.group_code})` : '공통코드'}
              </CardTitle>
              {group?.description && (
                <p className="text-muted-foreground text-sm">{group.description}</p>
              )}
            </div>
            {isAdmin && group && (
              <Button size="sm" onClick={() => openCode(null)}>
                <Plus /> 코드 추가
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <DataTable
              columns={codeColumns}
              data={codes}
              isLoading={codesLoading}
              searchPlaceholder="코드, 코드명 검색"
              onRowClick={openCode}
            />
          </CardContent>
        </Card>
      </div>

      <FormSheet
        open={groupOpen}
        onOpenChange={setGroupOpen}
        title={groupEditing ? '유형코드 수정' : '유형코드 등록'}
        description={
          groupEditing?.is_system
            ? '시스템 유형코드는 프로그램이 참조하므로 삭제할 수 없습니다.'
            : undefined
        }
        onSubmit={submitGroup}
        isSubmitting={save.isPending}
        readOnly={!isAdmin}
      >
        <TextField
          control={groupForm.control}
          name="group_code"
          label="유형코드"
          required
          disabled={Boolean(groupEditing)}
        />
        <TextField control={groupForm.control} name="group_name" label="유형명" required />
        <TextareaField control={groupForm.control} name="description" label="설명" />
        <TextField control={groupForm.control} name="sort_order" label="정렬순서" type="number" />
        <SwitchField control={groupForm.control} name="is_active" label="사용" />
      </FormSheet>

      <FormSheet
        open={codeOpen}
        onOpenChange={setCodeOpen}
        title={codeEditing ? '공통코드 수정' : '공통코드 등록'}
        description={group ? `유형: ${group.group_name} (${group.group_code})` : undefined}
        onSubmit={submitCode}
        isSubmitting={save.isPending}
        readOnly={!isAdmin}
      >
        <TextField
          control={codeForm.control}
          name="code"
          label="코드"
          required
          disabled={Boolean(codeEditing)}
        />
        <TextField control={codeForm.control} name="code_name" label="코드명" required />
        <TextField control={codeForm.control} name="sort_order" label="정렬순서" type="number" />
        <TextField control={codeForm.control} name="attr1" label="속성1" />
        <TextField control={codeForm.control} name="attr2" label="속성2" />
        <TextField control={codeForm.control} name="attr3" label="속성3" />
        <SwitchField control={codeForm.control} name="is_active" label="사용" />
      </FormSheet>
    </div>
  )
}
