'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdminCheck } from '@/hooks/useAdminCheck'

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface UseCrudTableConfig<T extends { id: unknown }> {
  requireAdmin?: boolean
  pageSize?: number
  skipFetch?: boolean
  buildUrl?: (page: number, pageSize: number, searchQuery: string) => string
  parseResponse?: (json: Record<string, unknown>) => {
    data: T[]
    pagination: PaginationInfo
    extra?: unknown
  }
}

export function useCrudTable<T extends { id: unknown }>(config: UseCrudTableConfig<T>) {
  const { requireAdmin = true, pageSize = 20, skipFetch = false, buildUrl, parseResponse } = config

  const { isLoading: authLoading, isAdmin, status } = useAdminCheck()

  const [data, setData] = useState<T[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [extra, setExtra] = useState<unknown>(null)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1,
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const fetchData = useCallback(
    async (pageNum: number, query: string) => {
      if (skipFetch || !buildUrl || !parseResponse) return
      setLoading(true)
      setError(null)
      try {
        const url = buildUrl(pageNum, pageSize, query)
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) {
          const { data: items, pagination: pg, extra: xt } = parseResponse(json)
          setData(items)
          setPagination(pg)
          if (xt !== undefined) setExtra(xt)
        } else {
          setError(json.error || 'Failed to fetch data')
        }
      } catch (_e) {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    },
    [buildUrl, parseResponse, pageSize, skipFetch],
  )

  useEffect(() => {
    if (skipFetch) return
    if (requireAdmin && !isAdmin) return
    fetchData(page, searchQuery)
  }, [page, searchQuery, isAdmin, fetchData, requireAdmin, skipFetch])

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput)
    setPage(1)
  }, [searchInput])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (data) setSelectedIds(new Set(data.map((d) => String(d.id))))
  }, [data])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }, [])

  const refresh = useCallback(() => {
    fetchData(page, searchQuery)
  }, [fetchData, page, searchQuery])

  return {
    authLoading: requireAdmin ? authLoading : false,
    isAdmin: requireAdmin ? isAdmin : true,
    status,
    data,
    setData,
    loading,
    setLoading,
    error,
    setError,
    extra,
    page,
    setPage,
    pagination,
    searchQuery,
    searchInput,
    setSearchInput,
    handleSearch,
    selectedIds,
    setSelectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelectionMode,
    setIsSelectionMode,
    selectedCount: selectedIds.size,
    refresh,
  }
}
