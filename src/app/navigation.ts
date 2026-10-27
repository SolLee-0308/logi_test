import {
  Boxes,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  MapPin,
  Package,
  Truck,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  ready?: boolean
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

// 업무 메뉴는 프로세스 정의에 따라 단계별로 채운다. ready가 없는 메뉴는 '준비 중' 화면을 보여준다.
export const navGroups: NavGroup[] = [
  {
    label: '개요',
    items: [{ title: '대시보드', url: '/', icon: LayoutDashboard, ready: true }],
  },
  {
    label: '입고',
    items: [
      { title: '입고예정', url: '/inbound', icon: Truck },
      { title: '입고작업', url: '/inbound/work', icon: ClipboardCheck },
    ],
  },
  {
    label: '재고',
    items: [{ title: '재고조회', url: '/inventory', icon: Boxes }],
  },
  {
    label: '기준정보',
    items: [
      { title: '화주', url: '/master/shippers', icon: Building2 },
      { title: '품목', url: '/master/items', icon: Package },
      { title: '창고·로케이션', url: '/master/locations', icon: MapPin },
    ],
  },
]

export const allNavItems = navGroups.flatMap((g) => g.items)
