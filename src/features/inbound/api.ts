import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { toErrorMessage } from '@/lib/errors'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { InboundPlanLine, InboundPlanSummary, SourceType } from '@/lib/types'

export const planKeys = {
  all: ['inbound-plans'] as const,
  list: (from: string, to: string) => ['inbound-plans', 'list', from, to] as const,
  detail: (id: string) => ['inbound-plans', 'detail', id] as const,
}

export function usePlans(from: string, to: string) {
  return useQuery({
    queryKey: planKeys.list(from, to),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('v_inbound_plans')
        .select('*')
        .gte('plan_date', from)
        .lte('plan_date', to)
        .order('plan_date', { ascending: false })
        .order('plan_no', { ascending: false })
      if (error) throw error
      return data as InboundPlanSummary[]
    },
  })
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: planKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const [head, lines] = await Promise.all([
        supabase!.from('v_inbound_plans').select('*').eq('id', id!).maybeSingle(),
        supabase!.from('inbound_plan_lines').select('*').eq('plan_id', id!).order('line_no'),
      ])
      if (head.error) throw head.error
      if (lines.error) throw lines.error
      return {
        plan: head.data as InboundPlanSummary | null,
        lines: (lines.data ?? []) as InboundPlanLine[],
      }
    },
  })
}

// 승인대기 건수 (대시보드·메뉴용)
export function usePendingCounts() {
  return useQuery({
    queryKey: ['pending-counts'],
    queryFn: async () => {
      const [plans, items] = await Promise.all([
        supabase!
          .from('inbound_plans')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING'),
        supabase!
          .from('items')
          .select('id', { count: 'exact', head: true })
          .eq('approval_status', 'PENDING'),
      ])
      return { plans: plans.count ?? 0, items: items.count ?? 0 }
    },
  })
}

function invalidatePlans() {
  queryClient.invalidateQueries({ queryKey: planKeys.all })
  queryClient.invalidateQueries({ queryKey: ['pending-counts'] })
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase!.rpc(fn, args)
  if (error) throw error
  return data as T
}

export type PlanLineInput = { item_id: string; plan_qty: number; remark?: string | null }

export function useSavePlan() {
  return useMutation({
    mutationFn: (args: {
      planId: string | null
      shipperId: string
      planDate: string
      remark: string
      sourceType: SourceType
      lines: PlanLineInput[]
    }) =>
      rpc<string>('save_inbound_plan', {
        p_plan_id: args.planId,
        p_shipper_id: args.shipperId,
        p_plan_date: args.planDate,
        p_remark: args.remark,
        p_source_type: args.sourceType,
        p_lines: args.lines,
      }),
    onSuccess: () => {
      invalidatePlans()
      toast.success('입고예정을 저장했습니다. 3PL 승인을 기다립니다.')
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}

export type ApproveLineInput = {
  line_id: string
  approved_qty: number
  adjust_reason: string | null
}

export function useApprovePlan() {
  return useMutation({
    mutationFn: (args: { planId: string; lines: ApproveLineInput[] }) =>
      rpc<void>('approve_inbound_plan', { p_plan_id: args.planId, p_lines: args.lines }),
    onSuccess: () => {
      invalidatePlans()
      toast.success('입고예정을 승인했습니다.')
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}

export function useRejectPlan() {
  return useMutation({
    mutationFn: (args: { planId: string; reason: string }) =>
      rpc<void>('reject_inbound_plan', { p_plan_id: args.planId, p_reason: args.reason }),
    onSuccess: () => {
      invalidatePlans()
      toast.success('입고예정을 반려했습니다.')
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}

export function useCancelPlan() {
  return useMutation({
    mutationFn: (planId: string) => rpc<void>('cancel_inbound_plan', { p_plan_id: planId }),
    onSuccess: () => {
      invalidatePlans()
      toast.success('입고예정을 취소했습니다.')
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}
