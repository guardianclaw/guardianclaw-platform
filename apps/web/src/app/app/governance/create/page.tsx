'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Loader2, AlertCircle } from 'lucide-react'
import { governanceApi, CreateProposalInput, UserProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PROPOSAL_TYPES = [
  { value: 'feature', label: 'Feature' },
  { value: 'governance', label: 'Governance' },
  { value: 'seed', label: 'Seed Update' },
  { value: 'docs', label: 'Documentation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'meta', label: 'Meta' },
]

const MIN_VOTING_POWER_TO_PROPOSE = 10 // 10M tokens = 10 votes

export default function NewProposalPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<CreateProposalInput>({
    title: '',
    body: '',
    type: 'feature',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    governanceApi
      .getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false))
  }, [])

  const canPropose = profile ? profile.voting_power >= MIN_VOTING_POWER_TO_PROPOSE : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!formData.title.trim() || formData.title.length < 10) {
      setError('Title must be at least 10 characters')
      return
    }
    if (!formData.body.trim() || formData.body.length < 100) {
      setError('Body must be at least 100 characters')
      return
    }

    setLoading(true)
    try {
      const newProposal = await governanceApi.createProposal(formData)
      router.push(`/app/governance/${newProposal.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Link
        href="/app/governance"
        className="mb-8 flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Governance
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl"
      >
        <h1 className="mb-2 text-3xl font-bold">Create Proposal</h1>
        <p className="mb-8 text-zinc-400">
          Draft a new governance proposal for the community to review and vote on.
        </p>

        {!profileLoading && !canPropose && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-400">Insufficient voting power</p>
              <p className="mt-1 text-sm text-zinc-400">
                You need at least {MIN_VOTING_POWER_TO_PROPOSE} votes (10M $GCLAW) to create a
                proposal.
                {profile && ` Your current voting power: ${profile.voting_power} votes.`}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Proposal Type</label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData((f) => ({ ...f, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {PROPOSAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium text-zinc-300">
              Title
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              placeholder="A clear, concise title"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-zinc-500">{formData.title.length}/200</p>
          </div>

          <div>
            <label htmlFor="body" className="mb-2 block text-sm font-medium text-zinc-300">
              Description (Markdown supported)
            </label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) => setFormData((f) => ({ ...f, body: e.target.value }))}
              placeholder="Describe your proposal in detail..."
              rows={15}
              className="font-mono"
            />
            <p className="mt-1 text-xs text-zinc-500">{formData.body.length} chars</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={loading || profileLoading || !canPropose}
            className="w-full"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Draft Proposal'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
