import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { z } from 'zod'

import { useAuth } from '@/lib/auth-context'
import type { Vehicle } from '@/lib/types'
import {
  emptyToNull,
  masterKeys,
  useCodeMap,
  useSaveRow,
  useShippers,
  useVehicles,
} from '@/features/master/api'
import { ShipperFilter } from '@/features/master/shipper-filter'
import { ActiveBadge } from '@/components/common/active-badge'
import { DataTable } from '@/components/common/data-table'
import type { DataColumn } from '@/components/common/data-table-features'
import { FormSheet } from '@/components/common/form-sheet'
import {
  CodeSelectField,
  ShipperSelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/common/form-fields'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'

const schema = z.object({
  shipper_id: z.string({ error: '화주사를 선택하세요.' }).min(1, '화주사를 선택하세요.'),
  vehicle_no: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().min(1, '차량번호를 입력하세요.').max(20)),
  vehicle_type_code: z.string().nullish(),
  tonnage: z.number().positive('0보다 커야 합니다.').nullish(),
  driver_name: z.string().max(50).nullish(),
  driver_tel: z.string().max(20).nullish(),
  remark: z.string().nullish(),
  is_active: z.boolean(),
})
type FormValues = z.input<typeof schema>

const EMPTY: Partial<FormValues> = { vehicle_no: '', is_active: true }

export function VehiclesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const { data: vehicles, isLoading } = useVehicles()
  const { data: shippers } = useShippers()
  const typeMap = useCodeMap('VEHICLE_TYPE')
  const save = useSaveRow()
  const [shipperId, setShipperId] = useState('all')
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  const shipperMap = useMemo(() => new Map((shippers ?? []).map((s) => [s.id, s])), [shippers])
  const rows = useMemo(
    () => (shipperId === 'all' ? vehicles : vehicles?.filter((v) => v.shipper_id === shipperId)),
    [vehicles, shipperId],
  )

  const columns = useMemo<DataColumn<Vehicle>[]>(
    () => [
      {
        id: 'shipper',
        header: '화주사',
        accessorFn: (r) => shipperMap.get(r.shipper_id)?.shipper_name ?? '',
      },
      {
        accessorKey: 'vehicle_no',
        header: '차량번호',
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      },
      {
        id: 'type',
        header: '차종',
        accessorFn: (r) =>
          r.vehicle_type_code ? (typeMap.get(r.vehicle_type_code) ?? r.vehicle_type_code) : '',
      },
      {
        accessorKey: 'tonnage',
        header: '톤수',
        cell: ({ getValue }) => (getValue() ? `${getValue()}톤` : ''),
      },
      { accessorKey: 'driver_name', header: '기사명' },
      { accessorKey: 'driver_tel', header: '기사 연락처' },
      {
        accessorKey: 'is_active',
        header: '사용',
        cell: ({ getValue }) => <ActiveBadge active={getValue()} />,
      },
    ],
    [shipperMap, typeMap],
  )

  const openForm = (row: Vehicle | null) => {
    setEditing(row)
    form.reset(row ?? { ...EMPTY, shipper_id: shipperId === 'all' ? undefined : shipperId })
    setOpen(true)
  }

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        table: 'vehicles',
        values: emptyToNull(values),
        match: editing ? { id: editing.id } : undefined,
        invalidate: masterKeys.vehicles,
      },
      { onSuccess: () => setOpen(false) },
    ),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="차량"
        description="화주사별 입고 차량입니다. ASN(차량별 상차지시) 등록 시 선택합니다."
        actions={
          isAdmin && (
            <Button onClick={() => openForm(null)}>
              <Plus /> 차량 등록
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="차량번호, 기사명 검색"
        onRowClick={openForm}
        toolbar={<ShipperFilter value={shipperId} onChange={setShipperId} />}
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? '차량 수정' : '차량 등록'}
        onSubmit={onSubmit}
        isSubmitting={save.isPending}
        readOnly={!isAdmin}
      >
        <ShipperSelectField
          control={form.control}
          name="shipper_id"
          label="화주사"
          required
          activeOnly
        />
        <TextField
          control={form.control}
          name="vehicle_no"
          label="차량번호"
          required
          placeholder="12가3456"
          description="공백은 자동으로 제거됩니다."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <CodeSelectField
            control={form.control}
            name="vehicle_type_code"
            label="차종"
            group="VEHICLE_TYPE"
            allowEmpty
          />
          <TextField control={form.control} name="tonnage" label="톤수" type="number" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField control={form.control} name="driver_name" label="기사명" />
          <TextField control={form.control} name="driver_tel" label="기사 연락처" type="tel" />
        </div>
        <TextareaField control={form.control} name="remark" label="비고" />
        <SwitchField control={form.control} name="is_active" label="사용" />
      </FormSheet>
    </div>
  )
}
