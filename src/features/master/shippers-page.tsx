import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { z } from 'zod'

import { useAuth } from '@/lib/auth-context'
import { formatBizNo, formatPhone, PHONE_REGEX } from '@/lib/format'
import type { Shipper } from '@/lib/types'
import { emptyToNull, masterKeys, useSaveRow, useShippers } from '@/features/master/api'
import { ActiveBadge } from '@/components/common/active-badge'
import { AddressFields } from '@/components/common/address-search'
import { DataTable } from '@/components/common/data-table'
import type { DataColumn } from '@/components/common/data-table-features'
import { FormSheet } from '@/components/common/form-sheet'
import { SwitchField, TextField, TextareaField } from '@/components/common/form-fields'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'

const optional = (re: RegExp, message: string) =>
  z.union([z.literal(''), z.string().regex(re, message)]).nullish()

// 화주코드는 DB 가 등록 시 자동 채번(S + 5자리)하므로 폼에서 다루지 않는다
const schema = z.object({
  shipper_name: z.string().trim().min(1, '화주명을 입력하세요.').max(100),
  biz_no: optional(/^\d{3}-\d{2}-\d{5}$/, '사업자번호 10자리를 입력하세요.'),
  zip_code: optional(/^\d{5}$/, '우편번호는 숫자 5자리입니다.'),
  address: z.string().nullish(),
  address_detail: z.string().max(200).nullish(),
  manager_name: z.string().max(50).nullish(),
  manager_tel: optional(PHONE_REGEX, '연락처를 끝까지 입력하세요.'),
  manager_email: z.union([z.literal(''), z.email('이메일 형식이 아닙니다.')]).nullish(),
  remark: z.string().nullish(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { shipper_name: '', is_active: true }

const columns: DataColumn<Shipper>[] = [
  {
    accessorKey: 'shipper_code',
    header: '화주코드',
    cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
  },
  { accessorKey: 'shipper_name', header: '화주명' },
  { accessorKey: 'biz_no', header: '사업자번호' },
  { accessorKey: 'manager_name', header: '담당자' },
  { accessorKey: 'manager_tel', header: '담당자 연락처' },
  {
    accessorKey: 'is_active',
    header: '사용',
    cell: ({ getValue }) => <ActiveBadge active={getValue()} />,
  },
]

export function ShippersPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const { data, isLoading } = useShippers()
  const save = useSaveRow()
  const [editing, setEditing] = useState<Shipper | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const openForm = (row: Shipper | null) => {
    setEditing(row)
    form.reset(row ?? EMPTY)
    setOpen(true)
  }

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        table: 'shippers',
        values: emptyToNull(values),
        match: editing ? { id: editing.id } : undefined,
        invalidate: masterKeys.shippers,
      },
      { onSuccess: () => setOpen(false) },
    ),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="화주사"
        description="입고를 위탁하는 화주사(거래처)를 관리합니다."
        actions={
          isAdmin && (
            <Button onClick={() => openForm(null)}>
              <Plus /> 화주사 등록
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="화주코드, 화주명 검색"
        onRowClick={openForm}
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? '화주사 수정' : '화주사 등록'}
        onSubmit={onSubmit}
        isSubmitting={save.isPending}
        readOnly={!isAdmin}
      >
        {/* 화주코드: 입력 없이 표시만 (등록 시 자동 채번, 변경 불가) */}
        <div className="space-y-2">
          <div className="text-sm font-medium">화주코드</div>
          <div className="bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-sm">
            {editing ? (
              <span className="text-foreground font-mono">{editing.shipper_code}</span>
            ) : (
              '저장하면 자동으로 부여됩니다. (S00001 형식)'
            )}
          </div>
        </div>
        <TextField control={form.control} name="shipper_name" label="화주명" required />
        <TextField
          control={form.control}
          name="biz_no"
          label="사업자번호"
          placeholder="숫자 10자리"
          format={formatBizNo}
        />
        <AddressFields form={form} disabled={!isAdmin} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField control={form.control} name="manager_name" label="담당자명" />
          <TextField
            control={form.control}
            name="manager_tel"
            label="담당자 연락처"
            type="tel"
            placeholder="숫자만 입력"
            format={formatPhone}
          />
        </div>
        <TextField control={form.control} name="manager_email" label="담당자 이메일" type="email" />
        <TextareaField control={form.control} name="remark" label="비고" />
        <SwitchField
          control={form.control}
          name="is_active"
          label="사용"
          description="미사용 화주사는 입고예정을 등록할 수 없습니다."
        />
      </FormSheet>
    </div>
  )
}
