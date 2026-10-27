import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Download, Plus, Upload, XCircle } from 'lucide-react'
import { z } from 'zod'

import { canApprove, isShipperUser, useAuth } from '@/lib/auth-context'
import { APPROVAL_LABEL, type ApprovalStatus, type Item } from '@/lib/types'
import {
  emptyToNull,
  masterKeys,
  useApproveItems,
  useCodeMap,
  useItems,
  useRejectItem,
  useSaveRow,
  useShippers,
} from '@/features/master/api'
import { ItemsExcelDialog } from '@/features/master/items-excel'
import { downloadItems } from '@/features/master/items-export'
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
import { StatusBadge } from '@/components/common/status-badge'
import { ShipperFilter } from '@/features/master/shipper-filter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  shipper_id: z.string({ error: '화주사를 선택하세요.' }).min(1, '화주사를 선택하세요.'),
  shipper_item_code: z.string().trim().min(1, '화주 품목코드를 입력하세요.').max(50),
  item_name: z.string().trim().min(1, '품명을 입력하세요.').max(200),
  spec: z.string().max(200).nullish(),
  barcode: z.string().trim().max(50).nullish(),
  uom_code: z.string({ error: '단위를 선택하세요.' }).min(1, '단위를 선택하세요.'),
  box_qty: z.number().int('정수로 입력하세요.').positive('1 이상 입력하세요.').nullish(),
  lot_yn: z.boolean(),
  expiry_yn: z.boolean(),
  remark: z.string().nullish(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const EMPTY: Partial<FormValues> = {
  shipper_item_code: '',
  item_name: '',
  uom_code: 'EA',
  lot_yn: false,
  expiry_yn: false,
  is_active: true,
}

export function ItemsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const shipperUser = isShipperUser(profile)
  const approver = canApprove(profile)
  // 등록: 관리자 또는 화주 사용자(자기 화주). 수정: 관리자 또는 자기 화주 품목
  const canCreate = isAdmin || shipperUser
  const canEditRow = (row: Item | null) =>
    isAdmin || (shipperUser && (!row || row.shipper_id === profile?.shipper_id))
  const { data: items, isLoading } = useItems()
  const approveItems = useApproveItems()
  const rejectItem = useRejectItem()
  const [approvalTab, setApprovalTab] = useState<'ALL' | ApprovalStatus>('ALL')
  const [rejectReason, setRejectReason] = useState('')
  const { data: shippers } = useShippers()
  const uomMap = useCodeMap('UOM')
  const save = useSaveRow()
  const [shipperId, setShipperId] = useState<string>('all')
  const [editing, setEditing] = useState<Item | null>(null)
  const [open, setOpen] = useState(false)
  const [excelOpen, setExcelOpen] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const shipperMap = useMemo(() => new Map((shippers ?? []).map((s) => [s.id, s])), [shippers])
  const rows = useMemo(
    () =>
      items?.filter(
        (i) =>
          (shipperId === 'all' || i.shipper_id === shipperId) &&
          (approvalTab === 'ALL' || i.approval_status === approvalTab),
      ),
    [items, shipperId, approvalTab],
  )
  const pendingCount = items?.filter((i) => i.approval_status === 'PENDING').length ?? 0

  const columns = useMemo<DataColumn<Item>[]>(
    () => [
      {
        id: 'shipper',
        header: '화주사',
        accessorFn: (r) => shipperMap.get(r.shipper_id)?.shipper_name ?? '',
      },
      {
        accessorKey: 'internal_code',
        header: '내부코드',
        cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
      },
      {
        accessorKey: 'shipper_item_code',
        header: '화주 품목코드',
        cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
      },
      { accessorKey: 'item_name', header: '품명' },
      { accessorKey: 'spec', header: '규격' },
      { accessorKey: 'barcode', header: '바코드' },
      { id: 'uom', header: '단위', accessorFn: (r) => uomMap.get(r.uom_code) ?? r.uom_code },
      {
        id: 'manage',
        header: '관리',
        accessorFn: (r) => `${r.lot_yn ? '로트' : ''} ${r.expiry_yn ? '유통기한' : ''}`.trim(),
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.lot_yn && <Badge variant="outline">로트</Badge>}
            {row.original.expiry_yn && <Badge variant="outline">유통기한</Badge>}
          </div>
        ),
      },
      {
        id: 'approval',
        header: '승인',
        accessorFn: (r) => APPROVAL_LABEL[r.approval_status],
        cell: ({ row }) => <StatusBadge status={row.original.approval_status} kind="approval" />,
      },
      {
        accessorKey: 'is_active',
        header: '사용',
        cell: ({ getValue }) => <ActiveBadge active={getValue()} />,
      },
    ],
    [shipperMap, uomMap],
  )

  const openForm = (row: Item | null) => {
    setEditing(row)
    setRejectReason('')
    const defaultShipper = shipperUser
      ? (profile?.shipper_id ?? undefined)
      : shipperId === 'all'
        ? undefined
        : shipperId
    form.reset(row ?? { ...EMPTY, shipper_id: defaultShipper })
    setOpen(true)
  }

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        table: 'items',
        values: emptyToNull(values),
        match: editing ? { id: editing.id } : undefined,
        invalidate: masterKeys.items,
      },
      { onSuccess: () => setOpen(false) },
    ),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="품목"
        description="화주사별 품목을 관리합니다. 3PL 내부코드는 자동으로 채번되며, 화주사 품목코드와 별도로 관리됩니다."
        actions={
          <>
            <Button
              variant="outline"
              title="현재 화면에 조회된 품목(내부코드 포함)을 엑셀로 내려받습니다. 등록용 양식은 '엑셀 일괄등록'에 있습니다."
              onClick={() => downloadItems(rows ?? [], shipperMap, uomMap)}
            >
              <Download /> 목록 다운로드
            </Button>
            {canCreate && (
              <>
                <Button variant="outline" onClick={() => setExcelOpen(true)}>
                  <Upload /> 엑셀 일괄등록
                </Button>
                <Button onClick={() => openForm(null)}>
                  <Plus /> 품목 등록
                </Button>
              </>
            )}
          </>
        }
      />
      <Tabs value={approvalTab} onValueChange={(v) => setApprovalTab(v as typeof approvalTab)}>
        <TabsList>
          <TabsTrigger value="ALL">전체</TabsTrigger>
          <TabsTrigger value="PENDING">
            승인대기
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="APPROVED">승인</TabsTrigger>
          <TabsTrigger value="REJECTED">반려</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchPlaceholder="코드, 품명, 바코드 검색"
        onRowClick={openForm}
        toolbar={
          <>
            {approver && approvalTab === 'PENDING' && (rows?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                disabled={approveItems.isPending}
                onClick={() => approveItems.mutate((rows ?? []).map((r) => r.id))}
              >
                <CheckCircle2 /> 조회된 {rows?.length}건 일괄 승인
              </Button>
            )}
            {!shipperUser && <ShipperFilter value={shipperId} onChange={setShipperId} />}
          </>
        }
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? '품목 수정' : '품목 등록'}
        description={
          editing
            ? `내부코드 ${editing.internal_code}`
            : shipperUser
              ? '저장하면 3PL 승인 후 입고예정에 사용할 수 있습니다. 내부코드는 자동으로 부여됩니다.'
              : '내부코드는 저장 시 자동으로 부여됩니다.'
        }
        onSubmit={onSubmit}
        isSubmitting={save.isPending}
        readOnly={!canEditRow(editing)}
        extraActions={
          approver &&
          editing?.approval_status === 'PENDING' && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!rejectReason.trim() || rejectItem.isPending}
                onClick={() =>
                  rejectItem.mutate(
                    { id: editing.id, reason: rejectReason },
                    { onSuccess: () => setOpen(false) },
                  )
                }
              >
                <XCircle /> 반려
              </Button>
              <Button
                type="button"
                disabled={approveItems.isPending}
                onClick={() =>
                  approveItems.mutate([editing.id], { onSuccess: () => setOpen(false) })
                }
              >
                <CheckCircle2 /> 승인
              </Button>
            </div>
          )
        }
      >
        {editing && (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">승인 상태</span>
              <StatusBadge status={editing.approval_status} kind="approval" />
            </div>
            {editing.approval_status === 'REJECTED' && editing.reject_reason && (
              <p className="text-destructive">반려 사유: {editing.reject_reason}</p>
            )}
            {editing.approval_status === 'PENDING' && approver && (
              <Textarea
                placeholder="반려할 경우 사유를 입력하세요."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            )}
            {shipperUser && editing.approval_status !== 'PENDING' && (
              <p className="text-muted-foreground text-xs">
                품목 정보를 수정하면 다시 3PL 승인을 받아야 입고예정에 사용할 수 있습니다.
              </p>
            )}
          </div>
        )}
        <ShipperSelectField
          control={form.control}
          name="shipper_id"
          label="화주사"
          required
          activeOnly
          disabled={Boolean(editing) || shipperUser}
          description="등록 후 변경할 수 없습니다."
        />
        <TextField
          control={form.control}
          name="shipper_item_code"
          label="화주 품목코드"
          required
          description="화주사에서 사용하는 품목코드입니다. 같은 화주사 안에서 중복될 수 없습니다."
        />
        <TextField control={form.control} name="item_name" label="품명" required />
        <TextField control={form.control} name="spec" label="규격" />
        <TextField
          control={form.control}
          name="barcode"
          label="바코드"
          description="PDA 스캔 시 품목을 찾는 값입니다."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <CodeSelectField
            control={form.control}
            name="uom_code"
            label="단위"
            group="UOM"
            required
          />
          <TextField control={form.control} name="box_qty" label="입수량" type="number" />
        </div>
        <SwitchField
          control={form.control}
          name="lot_yn"
          label="로트 관리"
          description="입고 검수 시 로트번호 입력이 필수가 됩니다."
        />
        <SwitchField
          control={form.control}
          name="expiry_yn"
          label="유통기한 관리"
          description="입고 검수 시 유통기한 입력이 필수가 됩니다."
        />
        <TextareaField control={form.control} name="remark" label="비고" />
        <SwitchField control={form.control} name="is_active" label="사용" />
      </FormSheet>
      <ItemsExcelDialog open={excelOpen} onOpenChange={setExcelOpen} />
    </div>
  )
}
