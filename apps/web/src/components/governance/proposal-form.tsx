'use client'

/**
 * Proposal creation form component
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, AlertCircle, FileText, Send, Eye, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useCreateProposal, useTokenBalance } from '@/hooks/use-governance'
import { ProposalType } from '@/lib/api'
import { GOVERNANCE_CONFIG, formatVotingPower, getTypeLabel } from '@/lib/governance'
import { TokenBalance } from './token-balance'

interface ProposalFormProps {
  className?: string
}

const PROPOSAL_TYPES: { value: ProposalType; label: string; description: string }[] = [
  {
    value: 'feature',
    label: 'Feature',
    description: 'Propose a new feature or functionality',
  },
  {
    value: 'governance',
    label: 'Governance',
    description: 'Changes to governance rules or parameters',
  },
  {
    value: 'seed',
    label: 'Seed Change',
    description: 'Modifications to CLAW protocol or prompts',
  },
  {
    value: 'partnership',
    label: 'Partnership',
    description: 'External collaborations and integrations',
  },
  {
    value: 'docs',
    label: 'Documentation',
    description: 'Documentation improvements or translations',
  },
  {
    value: 'meta',
    label: 'Meta',
    description: 'Signals, discussions, or other topics',
  },
]

export function ProposalForm({ className }: ProposalFormProps) {
  const router = useRouter()
  const { isAuthenticated, wallet } = useAuth()
  const { create, submit, loading, error } = useCreateProposal()
  const { balance } = useTokenBalance()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ProposalType>('feature')
  const [preview, setPreview] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const minTokens = GOVERNANCE_CONFIG.minTokensToPropose
  const displayBalance = balance / Math.pow(10, GOVERNANCE_CONFIG.tokenDecimals)
  const hasEnoughTokens = displayBalance >= minTokens
  const canSubmit =
    isAuthenticated && hasEnoughTokens && title.length >= 10 && description.length >= 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!canSubmit) {
      setFormError('Please fill in all required fields and ensure you have enough tokens')
      return
    }

    try {
      const proposal = await create({ title, body: description, type })
      if (proposal) {
        // Submit the proposal to start discussion
        await submit(proposal.id)
        router.push(`/app/governance/${proposal.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create proposal')
    }
  }

  const handleSaveDraft = async () => {
    setFormError(null)

    if (title.length < 10 || description.length < 100) {
      setFormError('Title must be at least 10 characters and description at least 100 characters')
      return
    }

    try {
      const proposal = await create({ title, body: description, type })
      if (proposal) {
        router.push(`/app/governance/${proposal.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save draft')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
        <div className="py-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h3 className="text-foreground mb-2 text-lg font-medium">Authentication Required</h3>
          <p className="text-muted-foreground">Please connect your wallet to create a proposal.</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6', className)}
    >
      {/* Eligibility check */}
      <div className="bg-card/50 border-border rounded-lg border p-4">
        <h3 className="text-muted-foreground mb-3 text-sm font-medium">Eligibility</h3>
        <div className="flex items-center justify-between">
          <TokenBalance variant="compact" />
          <div className={cn('text-sm', hasEnoughTokens ? 'text-emerald-400' : 'text-red-400')}>
            {hasEnoughTokens ? (
              <>Eligible to create proposals</>
            ) : (
              <>Need {formatVotingPower(minTokens)} tokens to create proposals</>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type selection */}
        <div>
          <label className="text-foreground/90 mb-3 block text-sm font-medium">Proposal Type</label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {PROPOSAL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  type === t.value
                    ? 'text-foreground border-emerald-500/50 bg-emerald-500/20'
                    : 'bg-card/50 border-border text-muted-foreground hover:border-border/80'
                )}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="text-foreground/90 mb-2 block text-sm font-medium">
            Title <span className="text-muted-foreground">(10-100 characters)</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="SIP-XXX: Your proposal title"
            minLength={10}
            maxLength={100}
            className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-4 py-3 focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">{title.length}/100 characters</p>
        </div>

        {/* Description with preview toggle */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="description" className="text-foreground/90 text-sm font-medium">
              Description{' '}
              <span className="text-muted-foreground">
                (100-10,000 characters, Markdown supported)
              </span>
            </label>
            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
            >
              {preview ? (
                <>
                  <Edit className="h-4 w-4" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Preview
                </>
              )}
            </button>
          </div>

          {preview ? (
            <div className="bg-card/50 border-border prose dark:prose-invert prose-sm min-h-[200px] max-w-none rounded-lg border p-4">
              {description || <span className="text-muted-foreground">Nothing to preview</span>}
            </div>
          ) : (
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`## Summary
Brief description of your proposal...

## Motivation
Why is this change needed?

## Implementation
How will this be implemented?`}
              minLength={100}
              maxLength={10000}
              rows={12}
              className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground w-full resize-none rounded-lg border px-4 py-3 font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {description.length}/10,000 characters
          </p>
        </div>

        {/* Error */}
        {(formError || error) && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p>{formError || error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-border flex items-center gap-4 border-t pt-4">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || title.length < 10 || description.length < 100}
            className="border-border text-muted-foreground hover:bg-muted flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Save as Draft
          </button>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="disabled:bg-muted flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit Proposal
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  )
}

export default ProposalForm
