// DB 테이블 행 타입 (supabase/migrations 기준). Supabase 클라우드 연결 후 생성 타입으로 대체 가능.

export type UserType = 'INTERNAL' | 'SHIPPER'
export type Role = 'ADMIN' | 'OPERATOR' | 'WORKER' | 'SHIPPER_USER'

type Audit = {
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type Profile = Audit & {
  id: string
  login_id: string
  user_name: string
  user_type: UserType
  role: Role
  shipper_id: string | null
  tel: string | null
  is_active: boolean
}

export type Company = Audit & {
  id: number
  company_name: string
  biz_no: string | null
  ceo_name: string | null
  address: string | null
  tel: string | null
  email: string | null
}

export type Shipper = Audit & {
  id: string
  shipper_code: string
  shipper_name: string
  biz_no: string | null
  address: string | null
  manager_name: string | null
  manager_tel: string | null
  manager_email: string | null
  remark: string | null
  is_active: boolean
}

export type Center = Audit & {
  id: string
  center_code: string
  center_name: string
  address: string | null
  tel: string | null
  is_default: boolean
  is_active: boolean
}

export type Item = Audit & {
  id: string
  shipper_id: string
  internal_code: string
  shipper_item_code: string
  item_name: string
  spec: string | null
  barcode: string | null
  uom_code: string
  box_qty: number | null
  lot_yn: boolean
  expiry_yn: boolean
  remark: string | null
  is_active: boolean
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  reject_reason: string | null
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type Vehicle = Audit & {
  id: string
  shipper_id: string
  vehicle_no: string
  vehicle_type_code: string | null
  tonnage: number | null
  driver_name: string | null
  driver_tel: string | null
  remark: string | null
  is_active: boolean
}

export type CodeGroup = Audit & {
  group_code: string
  group_name: string
  description: string | null
  sort_order: number
  is_system: boolean
  is_active: boolean
}

export type Code = Audit & {
  group_code: string
  code: string
  code_name: string
  sort_order: number
  attr1: string | null
  attr2: string | null
  attr3: string | null
  is_active: boolean
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '관리자',
  OPERATOR: '운영자',
  WORKER: '작업자',
  SHIPPER_USER: '화주사용자',
}

export const USER_TYPE_LABEL: Record<UserType, string> = {
  INTERNAL: '내부',
  SHIPPER: '화주',
}

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  PENDING: '승인대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

export type PlanStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type SourceType = 'MANUAL' | 'EXCEL' | 'AI'

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  PENDING: '승인대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
}

export const SOURCE_LABEL: Record<SourceType, string> = {
  MANUAL: '직접입력',
  EXCEL: '엑셀',
  AI: 'AI 판독',
}

export type InboundPlan = Audit & {
  id: string
  plan_no: string
  shipper_id: string
  center_id: string
  plan_date: string
  source_type: SourceType
  status: PlanStatus
  approved_by: string | null
  approved_at: string | null
  reject_reason: string | null
  remark: string | null
}

// v_inbound_plans
export type InboundPlanSummary = InboundPlan & {
  shipper_code: string
  shipper_name: string
  line_count: number
  total_plan_qty: number
  total_approved_qty: number | null
  created_by_name: string | null
  approved_by_name: string | null
}

export type InboundPlanLine = Audit & {
  id: string
  plan_id: string
  line_no: number
  item_id: string
  plan_qty: number
  approved_qty: number | null
  asn_qty: number
  adjust_reason: string | null
  remark: string | null
}
