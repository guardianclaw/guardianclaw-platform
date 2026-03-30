'use client'

import { Badge } from '@/components/ui/badge'

// Proposal status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  discussion: { label: 'Discussion', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  voting: { label: 'Voting', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  passed: { label: 'Passed', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  executed: {
    label: 'Executed',
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  no_quorum: { label: 'No Quorum', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
}

// Proposal type configuration
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  feature: { label: 'Feature', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  parameter: { label: 'Parameter', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  treasury: { label: 'Treasury', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  governance: {
    label: 'Governance',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  emergency: { label: 'Emergency', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
}

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}))

export const TYPE_OPTIONS = Object.entries(TYPE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}))

interface ProposalStatusBadgeProps {
  status: string
}

export function ProposalStatusBadge({ status }: ProposalStatusBadgeProps) {
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

interface ProposalTypeBadgeProps {
  type: string
}

export function ProposalTypeBadge({ type }: ProposalTypeBadgeProps) {
  const config = TYPE_CONFIG[type] || {
    label: type,
    color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  }
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

interface HiddenBadgeProps {
  hidden: boolean
}

export function HiddenBadge({ hidden }: HiddenBadgeProps) {
  if (!hidden) return null
  return (
    <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-500">
      Hidden
    </Badge>
  )
}
