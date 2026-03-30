import { ReactNode } from 'react'
import { CheckCircle, XCircle, Clock, MessageSquare, CircleDotDashed } from 'lucide-react'
import { Proposal, ProposalType, ProposalStatus } from '@/lib/api'

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    feature: 'Feature',
    governance: 'Governance',
    seed: 'Seed Update',
    docs: 'Documentation',
    partnership: 'Partnership',
    meta: 'Meta',
  }
  return labels[type] || 'Unknown'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    discussion: 'Discussion',
    voting: 'Voting',
    passed: 'Passed',
    rejected: 'Rejected',
    executed: 'Executed',
    cancelled: 'Cancelled',
    no_quorum: 'No Quorum',
  }
  return labels[status] || 'Unknown'
}

export function getTypeColor(type: string): string {
  switch (type) {
    case 'feature':
      return 'bg-blue-500/20 text-blue-400 border-blue-500'
    case 'governance':
      return 'bg-purple-500/20 text-purple-400 border-purple-500'
    case 'seed':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
    case 'docs':
      return 'bg-amber-500/20 text-amber-400 border-amber-500'
    case 'partnership':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500'
    case 'meta':
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500'
    default:
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500'
  }
}

interface StatusStyle {
  bg: string
  text: string
  border: string
  icon: ReactNode
}

export function getStatusStyles(status: string): StatusStyle {
  const styles: Record<string, StatusStyle> = {
    draft: {
      bg: 'bg-zinc-700/20',
      text: 'text-zinc-400',
      border: 'border-zinc-700',
      icon: <CircleDotDashed className="mr-1 h-3 w-3" />,
    },
    discussion: {
      bg: 'bg-purple-600/20',
      text: 'text-purple-400',
      border: 'border-purple-600',
      icon: <MessageSquare className="mr-1 h-3 w-3" />,
    },
    voting: {
      bg: 'bg-blue-600/20',
      text: 'text-blue-400',
      border: 'border-blue-600',
      icon: <Clock className="mr-1 h-3 w-3" />,
    },
    passed: {
      bg: 'bg-green-600/20',
      text: 'text-green-400',
      border: 'border-green-600',
      icon: <CheckCircle className="mr-1 h-3 w-3" />,
    },
    executed: {
      bg: 'bg-green-500',
      text: 'text-white',
      border: 'border-green-400',
      icon: <CheckCircle className="mr-1 h-3 w-3" />,
    },
    rejected: {
      bg: 'bg-red-600/20',
      text: 'text-red-400',
      border: 'border-red-600',
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
    cancelled: {
      bg: 'bg-zinc-800',
      text: 'text-zinc-500',
      border: 'border-zinc-700',
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
    no_quorum: {
      bg: 'bg-amber-900/20',
      text: 'text-amber-500',
      border: 'border-amber-900',
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
  }
  return styles[status] || styles.draft
}

export function getStatusColor(status: string): string {
  const styles = getStatusStyles(status)
  return styles.bg.replace('/20', '') // Return base color for ping animation
}

export function getStatusTextColor(status: string): string {
  const styles = getStatusStyles(status)
  return styles.text
}

// Fallback config (hooks will assume API fetch, this is for initial UI states if needed)
export const GOVERNANCE_CONFIG = {
  minTokensToVote: 1_000_000,
  minTokensToPropose: 10_000_000,
  tokensPerVote: 1_000_000,
  votingPeriodDays: 5,
  discussionPeriodDays: 5,
  quorumPercentage: 10, // 10%
  tokenDecimals: 6, // pump.fun tokens typically use 6 decimals
}

// Real $GCLAW token mint address on Solana mainnet
export const GCLAW_MINT = process.env.NEXT_PUBLIC_GCLAW_MINT || ''

// Shared data for marketing pages (/token, /governance)
export const PROPOSAL_TYPES = [
  {
    type: 'SIP-FEATURE',
    label: 'New Features & Integrations',
    description: 'New features, integrations, API improvements',
    quorum: 5,
    majority: 50,
  },
  {
    type: 'SIP-GOV',
    label: 'Governance Rule Changes',
    description: 'Governance rule changes',
    quorum: 10,
    majority: 66,
  },
  {
    type: 'SIP-SEED',
    label: 'CLAW & Seed Modifications',
    description: 'CLAW/seed modifications',
    quorum: 5,
    majority: 60,
  },
  {
    type: 'SIP-DOCS',
    label: 'Documentation & Guides',
    description: 'Documentation, guides',
    quorum: 3,
    majority: 50,
  },
  {
    type: 'SIP-PARTNER',
    label: 'External Partnerships',
    description: 'External partnerships',
    quorum: 5,
    majority: 50,
  },
  {
    type: 'SIP-META',
    label: 'Temperature Checks',
    description: 'Temperature checks',
    quorum: 3,
    majority: 50,
  },
]

export const GOVERNANCE_RULES = [
  { label: 'Minimum to Vote', value: '1,000,000 $GCLAW', detail: '1M tokens = 1 vote' },
  { label: 'Minimum to Propose', value: '10,000,000 $GCLAW', detail: '10M tokens = 10 votes' },
  { label: 'Voting Period', value: '5 days', detail: 'After discussion phase' },
  { label: 'Discussion Period', value: '5 days', detail: 'Before voting opens' },
]

export function formatVotingPower(power: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(power)
}

export function formatSipNumber(sipNumber: number | string): string {
  return `SIP-${String(sipNumber).padStart(3, '0')}`
}

export function formatWalletAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function calculateVotePercentages(proposal: Proposal): {
  forPercent: number
  againstPercent: number
} {
  const totalVotes = proposal.votes_for + proposal.votes_against
  const forPercent = totalVotes > 0 ? (proposal.votes_for / totalVotes) * 100 : 0
  const againstPercent = totalVotes > 0 ? (proposal.votes_against / totalVotes) * 100 : 0
  return { forPercent, againstPercent }
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
  hasEnded: boolean
  isLive: boolean // Indicates if the period has started but not ended
}

export function getTimeRemaining(endDate: string | Date, startDate?: string | Date): TimeRemaining {
  const end = new Date(endDate).getTime()
  const start = startDate ? new Date(startDate).getTime() : Date.now()
  const now = Date.now()

  const total = end - now
  const hasEnded = total < 0
  const isLive = !hasEnded && now >= start

  const seconds = Math.floor((total / 1000) % 60)
  const minutes = Math.floor((total / 1000 / 60) % 60)
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24)
  const days = Math.floor(total / (1000 * 60 * 60 * 24))

  return {
    total: Math.max(0, total),
    days: Math.max(0, days),
    hours: Math.max(0, hours),
    minutes: Math.max(0, minutes),
    seconds: Math.max(0, seconds),
    hasEnded,
    isLive,
  }
}
