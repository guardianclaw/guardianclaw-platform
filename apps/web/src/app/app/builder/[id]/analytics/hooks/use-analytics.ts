'use client'

import { useState, useEffect, useCallback } from 'react'
import { agentsApi, AnalyticsResponseV2 } from '@/lib/api'

interface UseAnalyticsOptions {
  days?: number
  enabled?: boolean
}

interface UseAnalyticsReturn {
  data: AnalyticsResponseV2 | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useAnalyticsV2(
  agentId: string | undefined,
  options: UseAnalyticsOptions = {}
): UseAnalyticsReturn {
  const { days = 7, enabled = true } = options
  const [data, setData] = useState<AnalyticsResponseV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    if (!agentId || !enabled) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await agentsApi.analyticsV2(agentId, { days })
      setData(response)
    } catch (err) {
      console.error('Failed to fetch analytics v2:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [agentId, days, enabled])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  }
}
