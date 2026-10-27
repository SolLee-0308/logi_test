import {
  Boxes,
  Building,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  ListTree,
  Package,
  Truck,
  UserCog,
  Warehouse,
  ScanBarcode,
  type LucideIcon,
} from 'lucide-react'

import type { Role } from '@/lib/types'

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  ready?: boolean
  // 없으면 모든 사용자에게 노출
  roles?: Role[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

const INTERNAL: Role[] = ['ADMIN', 'OPERATOR', 'WORKER']

// 업무 메뉴는 프로세스 정의에 따라 단계별로 채운다. ready가 없는 메뉴는 '준비 중' 화면을 보여준다.
export const navGroups: NavGroup[] = [
  {
    label: '개요',
    items: [{ title: '대시보드', url: '/', icon: LayoutDashboard, ready: true }],
  },
  {
    label: '입고',
    items: [
      { title: '입고예정', url: '/inbound/plans', icon: ClipboardCheck, ready: true },
      { title: 'ASN·상차지시', url: '/inbound/asn', icon: Truck },
      { title: '입고현황', url: '/inbound/status', icon: Boxes },
      { title: 'PDA 작업', url: '/pda', icon: ScanBarcode },
    ],
  },
  {
    label: '기준정보',
    items: [
      { title: '회사정보', url: '/master/company', icon: Building, ready: true, roles: INTERNAL },
      { title: '화주사', url: '/master/shippers', icon: Building2, ready: true },
      { title: '센터정보', url: '/master/center', icon: Warehouse, ready: true },
      { title: '품목', url: '/master/items', icon: Package, ready: true },
      { title: '차량', url: '/master/vehicles', icon: Truck, ready: true },
      { title: '공통코드', url: '/master/codes', icon: ListTree, ready: true, roles: INTERNAL },
    ],
  },
  {
    label: '관리',
    items: [{ title: '사용자', url: '/admin/users', icon: UserCog, ready: true, roles: ['ADMIN'] }],
  },
]

export const allNavItems = navGroups.flatMap((g) => g.items)

// 현재 경로에 해당하는 메뉴 (하위 경로 포함, 가장 긴 경로 우선)
export function findNavItem(pathname: string) {
  return allNavItems
    .filter((i) => pathname === i.url || (i.url !== '/' && pathname.startsWith(i.url + '/')))
    .sort((a, b) => b.url.length - a.url.length)[0]
}
