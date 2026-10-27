import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { toErrorMessage } from '@/lib/errors'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { AsnLineView, AsnSummary, OpenPlanLine } from '@/lib/types'

export const asnKeys = {
  all: ['asns'] as const,
  list: (from: string, to: string) => ['asns', 'list', from, to] as const,
  detail: (id: string) => ['asns', 'detail', id] as const,
  open: (shipperId: string, date: string) => ['asns', 'open', shipperId, date] as const,
  loading: (id: string) => ['asns', 'loading', id] as const,
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase!.rpc(fn, args)
  if (error) throw error
  return data as T
}

function invalidateAsn() {
  queryClient.invalidateQueries({ queryKey: asnKeys.all })
  queryClient.invalidateQueries({ queryKey: ['inbound-plans'] })
}

export function useAsns(from: string, to: string) {
  return useQuery({
    queryKey: asnKeys.list(from, to),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('v_asns')
        .select('*')
        .gte('asn_date', from)
        .lte('asn_date', to)
        .order('asn_date', { ascending: false })
        .order('asn_no', { ascending: false })
      if (error) throw error
      return data as AsnSummary[]
    },
  })
}

async function fetchAsnWithLines(id: string) {
  const [head, lines] = await Promise.all([
    supabase!.from('v_asns').select('*').eq('id', id).maybeSingle(),
    supabase!.from('v_asn_lines').select('*').eq('asn_id', id).order('line_no'),
  ])
  if (head.error) throw head.error
  if (lines.error) throw lines.error
  return { asn: head.data as AsnSummary | null, lines: (lines.data ?? []) as AsnLineView[] }
}

export function useAsn(id: string | undefined) {
  return useQuery({
    queryKey: asnKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => fetchAsnWithLines(id!),
  })
}

// ASN 배정 대상: 화주사·일자의 승인된 입고예정 라인
export function useOpenPlanLines(shipperId: string, date: string) {
  return useQuery({
    queryKey: asnKeys.open(shipperId, date),
    enabled: Boolean(shipperId && date),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('v_open_plan_lines')
        .select('*')
        .eq('shipper_id', shipperId)
        .eq('plan_date', date)
        .order('plan_no')
        .order('line_no')
      if (error) throw error
      return data as OpenPlanLine[]
    },
  })
}

export type AsnLineInput = { plan_line_id: string; order_qty: number }

export function useSaveAsn() {
  return useMutation({
    mutationFn: (args: {
      asnId: string | null
      shipperId: string
      asnDate: string
      vehicleId: string
      remark: string
      lines: AsnLineInput[]
    }) =>
      rpc<string>('save_asn', {
        p_asn_id: args.asnId,
        p_shipper_id: args.shipperId,
        p_asn_date: args.asnDate,
        p_vehicle_id: args.vehicleId,
        p_remark: args.remark,
        p_lines: args.lines,
      }),
    onSuccess: () => {
      invalidateAsn()
      toast.success('ASN을 저장했습니다. 상차지시서를 출력할 수 있습니다.')
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}

export function useCancelAsn() {
  return useMutation({
    mutationFn: (asnId: string) => rpc<void>('cancel_asn', { p_asn_id: asnId }),
    onSuccess: () => {
      invalidateAsn()
      toast.success('ASN을 취소했습니다. 배정 수량이 입고예정으로 돌아갑니다.')
    },
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}

// ---------- PDA 상차 ----------
export async function startLoading(asnNo: string) {
  return rpc<string>('start_loading', { p_asn_no: asnNo })
}

// 상차 중인 ASN 정보 (상차 전표 id 기준)
export function useLoadingView(loadingId: string | undefined) {
  return useQuery({
    queryKey: asnKeys.loading(loadingId ?? ''),
    enabled: Boolean(loadingId),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('v_asns')
        .select('id')
        .eq('loading_id', loadingId!)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('상차 전표를 찾을 수 없습니다.')
      return fetchAsnWithLines(data.id)
    },
  })
}

function refreshLoading(loadingId: string) {
  queryClient.invalidateQueries({ queryKey: asnKeys.loading(loadingId) })
  queryClient.invalidateQueries({ queryKey: asnKeys.all })
}

export function useScanLoading(loadingId: string) {
  return useMutation({
    mutationFn: (args: { barcode?: string; asnLineId?: string; qty: number }) =>
      rpc<string>('scan_loading', {
        p_loading_id: loadingId,
        p_barcode: args.barcode ?? null,
        p_asn_line_id: args.asnLineId ?? null,
        p_qty: args.qty,
      }),
    onSuccess: () => refreshLoading(loadingId),
  })
}

export function useAdjustLoading(loadingId: string) {
  return useMutation({
    mutationFn: (args: { asnLineId: string; qty: number }) =>
      rpc<void>('adjust_loading_qty', {
        p_loading_id: loadingId,
        p_asn_line_id: args.asnLineId,
        p_qty: args.qty,
      }),
    onSuccess: () => refreshLoading(loadingId),
    onError: (e) => toast.error(toErrorMessage(e)),
  })
}

export function useCompleteLoading(loadingId: string) {
  return useMutation({
    mutationFn: () => rpc<void>('complete_loading', { p_loading_id: loadingId }),
    onSuccess: () => refreshLoading(loadingId),
  })
}

// 오늘 이후 승인분 중 아직 차량에 배정하지 않은 라인 (화주 대시보드 할 일)
export function useUnassignedPlanLines(fromDate: string) {
  return useQuery({
    queryKey: ['asns', 'unassigned', fromDate],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('v_open_plan_lines')
        .select('plan_date, remaining_qty')
        .gte('plan_date', fromDate)
        .gt('remaining_qty', 0)
      if (error) throw error
      return data as { plan_date: string; remaining_qty: number }[]
    },
  })
}
