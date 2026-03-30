'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './use-auth'

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'viewer'

interface AdminPermissions {
  dashboards: string[]
  actions: string[]
}

interface AdminAuthState {
  isLoading: boolean
  isAdmin: boolean
  role: AdminRole | null
  permissions: AdminPermissions | null
  error: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

export function useAdminAuth() {
  const { isAuthenticated, token } = useAuth()
  const [state, setState] = useState<AdminAuthState>({
    isLoading: true,
    isAdmin: false,
    role: null,
    permissions: null,
    error: null,
  })

  const verifyAdmin = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setState({
        isLoading: false,
        isAdmin: false,
        role: null,
        permissions: null,
        error: null,
      })
      return
    }

    try {
      const response = await fetch(`${API_URL}/admin/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setState({
          isLoading: false,
          isAdmin: data.verified,
          role: data.role,
          permissions: data.permissions,
          error: null,
        })
      } else if (response.status === 401) {
        // Not authenticated - user needs to sign in
        // Don't set error here, let the layout show the sign-in prompt
        setState({
          isLoading: false,
          isAdmin: false,
          role: null,
          permissions: null,
          error: null, // null error means "not authenticated", not "access denied"
        })
      } else if (response.status === 403) {
        setState({
          isLoading: false,
          isAdmin: false,
          role: null,
          permissions: null,
          error: 'Access denied. Admin role required.',
        })
      } else {
        setState({
          isLoading: false,
          isAdmin: false,
          role: null,
          permissions: null,
          error: 'Failed to verify admin access',
        })
      }
    } catch {
      setState({
        isLoading: false,
        isAdmin: false,
        role: null,
        permissions: null,
        error: 'Network error',
      })
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    verifyAdmin()
  }, [verifyAdmin])

  const hasPermission = useCallback(
    (action: string) => {
      return state.permissions?.actions?.includes(action) ?? false
    },
    [state.permissions]
  )

  const hasDashboardAccess = useCallback(
    (dashboard: string) => {
      return state.permissions?.dashboards?.includes(dashboard) ?? false
    },
    [state.permissions]
  )

  return {
    ...state,
    hasPermission,
    hasDashboardAccess,
    refresh: verifyAdmin,
  }
}
