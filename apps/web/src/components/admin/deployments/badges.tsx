'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Ban, Globe, Server, Settings } from 'lucide-react'

// Environment colors
const ENVIRONMENT_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  production: {
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: <Globe className="h-3 w-3" />,
  },
  staging: {
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    icon: <Server className="h-3 w-3" />,
  },
  development: {
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: <Settings className="h-3 w-3" />,
  },
}

// Deployment status configuration
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Pending' },
  deployed: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Active' },
  stopped: { color: 'bg-gray-500/10 text-gray-400 border-gray-400/20', label: 'Stopped' },
  failed: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Failed' },
}

export interface EnvironmentBadgeProps {
  environment: string
  showIcon?: boolean
}

export function EnvironmentBadge({ environment, showIcon = true }: EnvironmentBadgeProps) {
  const config = ENVIRONMENT_CONFIG[environment] || ENVIRONMENT_CONFIG.development

  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${config.color}`}>
      {showIcon && config.icon}
      <span className="capitalize">{environment}</span>
    </Badge>
  )
}

export interface DeploymentStatusBadgeProps {
  status: string
  isSuspended: boolean
  isActive: boolean
}

export function DeploymentStatusBadge({
  status,
  isSuspended,
  isActive,
}: DeploymentStatusBadgeProps) {
  if (isSuspended) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <Ban className="h-3 w-3" />
        Suspended
      </Badge>
    )
  }

  if (!isActive && status === 'deployed') {
    return (
      <Badge variant="outline" className="border-gray-500/20 bg-gray-500/10 text-gray-500">
        Inactive
      </Badge>
    )
  }

  const config = STATUS_CONFIG[status] || { color: '', label: status }

  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

// Re-export for filters
export const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
]

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}))
