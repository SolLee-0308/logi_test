import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import { toErrorMessage } from '@/lib/errors'
import type { Center, Code, CodeGroup, Company, Item, Shipper, Vehicle } from '@/lib/types'

// 기준정보 조회 키
export const masterKeys = {
  company: ['company'] as const,
  center: ['center'] as const,
  shippers: ['shippers'] as const,
  items: ['items'] as const,
  vehicles: ['vehicles'] as const,
  codeGroups: ['code-groups'] as const,
  codes: (group?: string) => ['codes', group ?? 'all'] as const,
}

async function selectAll<T>(table: string, order: string, ascending = true): Promise<T[]> {
  const { data, error } = await supabase!.from(table).select('*').order(order, { ascending })
  if (error) throw error
  return data as T[]
}

export const useCompany = () =>
  useQuery({
    queryKey: masterKeys.company,
    queryFn: async () => {
      const { data, error } = await supabase!.from('company').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      return data as Company | null
    },
  })

export const useDefaultCenter = () =>
  useQuery({
    queryKey: masterKeys.center,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('centers')
        .select('*')
        .eq('is_default', true)
        .maybeSingle()
      if (error) throw error
      return data as Center | null
    },
  })

export const useShippers = () =>
  useQuery({
    queryKey: masterKeys.shippers,
    queryFn: () => selectAll<Shipper>('shippers', 'shipper_code'),
  })

export const useItems = () =>
  useQuery({ queryKey: masterKeys.items, queryFn: () => selectAll<Item>('items', 'internal_code') })

export const useVehicles = () =>
  useQuery({
    queryKey: masterKeys.vehicles,
    queryFn: () => selectAll<Vehicle>('vehicles', 'vehicle_no'),
  })

export const useCodeGroups = () =>
  useQuery({
    queryKey: masterKeys.codeGroups,
    queryFn: () => selectAll<CodeGroup>('code_groups', 'sort_order'),
  })

export const useCodes = (group?: string) =>
  useQuery({
    queryKey: masterKeys.codes(group),
    queryFn: async () => {
      let query = supabase!.from('codes').select('*').order('sort_order')
      if (group) query = query.eq('group_code', group)
      const { data, error } = await query
      if (error) throw error
      return data as Code[]
    },
  })

// 코드 → 코드명 조회용 맵
export function useCodeMap(group: string) {
  const { data } = useCodes(group)
  return useMemo(() => new Map((data ?? []).map((c) => [c.code, c.code_name])), [data])
}

type SaveArgs = {
  table: string
  values: Record<string, unknown>
  // 수정 대상 키. 없으면 insert
  match?: Record<string, unknown>
  invalidate: readonly unknown[]
  successMessage?: string
}

// 기준정보 공통 저장(등록/수정)
export function useSaveRow() {
  return useMutation({
    mutationFn: async ({ table, values, match }: SaveArgs) => {
      const query = match
        ? supabase!.from(table).update(values).match(match).select()
        : supabase!.from(table).insert(values).select()
      const { data, error } = await query
      if (error) throw error
      if (match && (!data || data.length === 0)) {
        throw new Error('저장된 데이터가 없습니다. 권한을 확인하세요.')
      }
      return data
    },
    onSuccess: (_data, { invalidate, successMessage }) => {
      queryClient.invalidateQueries({ queryKey: invalidate })
      toast.success(successMessage ?? '저장했습니다.')
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  })
}

export function useDeleteRow() {
  return useMutation({
    mutationFn: async ({
      table,
      match,
    }: {
      table: string
      match: Record<string, unknown>
      invalidate: readonly unknown[]
    }) => {
      const { error } = await supabase!.from(table).delete().match(match)
      if (error) throw error
    },
    onSuccess: (_data, { invalidate }) => {
      queryClient.invalidateQueries({ queryKey: invalidate })
      toast.success('삭제했습니다.')
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  })
}

// 빈 문자열은 null 로 저장
export function emptyToNull<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])) as T
}

export function useApproveItems() {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase!.rpc('approve_items', { p_item_ids: ids })
      if (error) throw error
      return data as number
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: masterKeys.items })
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] })
      toast.success(`품목 ${count}건을 승인했습니다.`)
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  })
}

export function useRejectItem() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase!.rpc('reject_item', { p_item_id: id, p_reason: reason })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterKeys.items })
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] })
      toast.success('품목을 반려했습니다.')
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  })
}
