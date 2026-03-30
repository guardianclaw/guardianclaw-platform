'use client'

import { Badge } from '@/components/ui/badge'

// Request type configuration
const REQUEST_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  export: { label: 'Export', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  deletion: { label: 'Deletion', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  access: { label: 'Access', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  rectification: {
    label: 'Rectification',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
}

export const REQUEST_TYPE_OPTIONS = Object.entries(REQUEST_TYPE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}))

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}))

interface RequestTypeBadgeProps {
  type: string
}

export function RequestTypeBadge({ type }: RequestTypeBadgeProps) {
  const config = REQUEST_TYPE_CONFIG[type] || {
    label: type,
    color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  }
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

interface RequestStatusBadgeProps {
  status: string
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  }
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

interface DataCategoryBadgeProps {
  category: string
}

export function DataCategoryBadge({ category }: DataCategoryBadgeProps) {
  return (
    <Badge variant="outline" className="border-gray-500/20 bg-gray-500/10 text-gray-500">
      {category}
    </Badge>
  )
}
