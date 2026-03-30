import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import { useAuth } from '@/hooks/use-auth'
import {
  governanceApi,
  Proposal,
  GovernanceStats,
  UserProfile as UserGovernanceProfile,
  Comment,
  VoteInput,
  VoteChoice,
  VoteCheckResponse,
  GovernanceConfigResponse,
} from '@/lib/api'

// =============================================================================
// GOVERNANCE CONFIG
// =============================================================================

export function useGovernanceConfig() {
  const [config, setConfig] = useState<GovernanceConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    governanceApi
      .getGovernanceConfig()
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { config, loading, error }
}

// =============================================================================
// PROPOSALS LIST
// =============================================================================

interface ProposalFilters {
  status?: string
  type?: string
  page?: number
  limit?: number
}

export function useProposals(initialFilters: ProposalFilters = {}) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [pagination, setPagination] = useState<any | null>(null)
  const [filters, setFilters] = useState<ProposalFilters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProposals = useCallback(
    async (newFilters?: Partial<ProposalFilters>) => {
      setLoading(true)
      setError(null)

      const currentFilters = newFilters ? { ...filters, ...newFilters } : filters

      try {
        const data = await governanceApi.listProposals(currentFilters)
        setProposals(data.proposals)
        setPagination(data.pagination)
        if (newFilters) {
          setFilters(currentFilters)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch proposals')
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    fetchProposals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  const updateFilters = useCallback((newFilters: Partial<ProposalFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  return {
    proposals,
    pagination,
    filters,
    loading,
    error,
    refetch: fetchProposals,
    updateFilters,
  }
}

// =============================================================================
// SINGLE PROPOSAL
// =============================================================================

export function useProposal(proposalId: string | null) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProposal = useCallback(async () => {
    if (!proposalId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await governanceApi.getProposal(proposalId)
      setProposal(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposal')
    } finally {
      setLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    fetchProposal()
  }, [fetchProposal])

  return { proposal, loading, error, refetch: fetchProposal }
}

// =============================================================================
// GOVERNANCE MESSAGE SIGNING
// =============================================================================

export function useGovernanceMessage() {
  const { signMessage, publicKey } = useWallet()

  const signGovernanceMessage = useCallback(
    async (
      action: string,
      data: Record<string, any>
    ): Promise<{ signature: string; message: string }> => {
      if (!signMessage || !publicKey) {
        throw new Error('Wallet not connected or does not support signing')
      }

      const messageContent = JSON.stringify({
        action,
        ...data,
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
        domain: 'guardianclaw.org',
      })
      const messageBytes = new TextEncoder().encode(messageContent)
      const signatureBytes = await signMessage(messageBytes)
      const signature = Buffer.from(signatureBytes).toString('base64')

      return { signature, message: messageContent }
    },
    [signMessage, publicKey]
  )

  return { signGovernanceMessage }
}

// =============================================================================
// VOTING
// =============================================================================

export function useVoting(proposalId: string | null) {
  const { token, isAuthenticated } = useAuth()
  const { signGovernanceMessage } = useGovernanceMessage()
  const { publicKey } = useWallet()

  const [votingPower, setVotingPower] = useState<number | null>(null)
  const [userVote, setUserVote] = useState<VoteChoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingVote, setCheckingVote] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch voting power and existing vote
  useEffect(() => {
    if (!publicKey || !proposalId) {
      setCheckingVote(false)
      return
    }

    setCheckingVote(true)

    Promise.all([governanceApi.getProfile(), governanceApi.checkVote(proposalId)])
      .then(([profile, voteCheck]) => {
        setVotingPower(profile.voting_power)
        if (voteCheck.voted && voteCheck.vote_direction) {
          setUserVote(voteCheck.vote_direction)
        } else {
          setUserVote(null)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch voting status', err)
        setVotingPower(0)
        setUserVote(null)
      })
      .finally(() => setCheckingVote(false))
  }, [publicKey, proposalId])

  const vote = useCallback(
    async (choice: VoteChoice, comment?: string): Promise<VoteInput | null> => {
      if (!isAuthenticated || !token || !proposalId || !publicKey) {
        setError('Please connect your wallet first')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const { signature, message } = await signGovernanceMessage('vote', {
          proposal_id: proposalId,
          choice,
        })

        const result = await governanceApi.vote(proposalId, {
          vote_direction: choice,
          signature: signature,
          message: message,
        })

        setUserVote(choice)
        return { vote_direction: choice, signature: signature, message: message }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Vote failed'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [proposalId, token, signGovernanceMessage, isAuthenticated, publicKey]
  )

  return {
    votingPower,
    userVote,
    canVote: (votingPower || 0) >= 1 && !userVote, // 1M tokens = 1 vote (min 1 vote to participate)
    loading,
    checkingVote,
    error,
    vote,
  }
}

// =============================================================================
// COMMENTS
// =============================================================================

export function useComments(proposalId: string | null) {
  const { token, isAuthenticated } = useAuth()
  const { signGovernanceMessage } = useGovernanceMessage()

  const [comments, setComments] = useState<Comment[]>([])
  const [pagination, setPagination] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    if (!proposalId) return

    setLoading(true)
    setError(null)

    try {
      const data = await governanceApi.getComments(proposalId)
      setComments(data)
      setPagination(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const addComment = useCallback(
    async (body: string, parentId?: string): Promise<Comment | null> => {
      if (!isAuthenticated || !token || !proposalId) {
        setError('Please connect your wallet first')
        return null
      }

      setPosting(true)
      setError(null)

      try {
        const { signature, message } = await signGovernanceMessage('comment', {
          proposal_id: proposalId,
          body,
          parent_id: parentId,
        })

        const result = await governanceApi.addComment(proposalId, {
          content: body,
          signature: signature,
          message: message,
          parent_comment_id: parentId,
        })

        // Refresh comments
        await fetchComments()
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add comment'
        setError(errorMessage)
        throw err
      } finally {
        setPosting(false)
      }
    },
    [proposalId, token, signGovernanceMessage, isAuthenticated, fetchComments]
  )

  return {
    comments,
    pagination,
    loading,
    posting,
    error,
    addComment,
    refetch: fetchComments,
  }
}

// =============================================================================
// USER GOVERNANCE PROFILE
// =============================================================================

export function useUserGovernance() {
  const { wallet } = useAuth()
  const walletAddress = wallet

  const [profile, setProfile] = useState<UserGovernanceProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false)
      return
    }

    setLoading(true)
    governanceApi
      .getProfile()
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [walletAddress])

  return { profile, loading, error }
}

// =============================================================================
// TOKEN BALANCE
// =============================================================================

export function useTokenBalance() {
  const { wallet } = useAuth()
  const walletAddress = wallet

  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await governanceApi.getProfile()
      setBalance(data.voting_power)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, loading, error, refetch: fetchBalance }
}

// =============================================================================
// GOVERNANCE STATS
// =============================================================================

export function useGovernanceStats() {
  const [stats, setStats] = useState<GovernanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    governanceApi
      .getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}

// =============================================================================
// CREATE PROPOSAL
// =============================================================================

export function useCreateProposal() {
  const { token, isAuthenticated } = useAuth()
  const { signGovernanceMessage } = useGovernanceMessage()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (data: { title: string; body: string; type: string }): Promise<Proposal | null> => {
      if (!isAuthenticated || !token) {
        setError('Please connect your wallet first')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const proposal = await governanceApi.createProposal(data)
        return proposal
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create proposal'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token, isAuthenticated]
  )

  const submit = useCallback(
    async (proposalId: string, votingPeriodDays?: number): Promise<Proposal | null> => {
      if (!isAuthenticated || !token) {
        setError('Please connect your wallet first')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const { signature, message } = await signGovernanceMessage('submit', {
          proposal_id: proposalId,
          voting_period_days: votingPeriodDays,
        })

        const proposal = await governanceApi.submitProposal(proposalId, {
          signature,
          message,
          voting_period_days: votingPeriodDays,
        })
        return proposal
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit proposal'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token, isAuthenticated, signGovernanceMessage]
  )

  const finalize = useCallback(
    async (proposalId: string): Promise<Proposal | null> => {
      if (!isAuthenticated || !token) {
        setError('Please connect your wallet first')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const proposal = await governanceApi.finalizeProposal(proposalId)
        return proposal
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to finalize proposal'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token, isAuthenticated]
  )

  const cancel = useCallback(
    async (proposalId: string, reason?: string): Promise<Proposal | null> => {
      if (!isAuthenticated || !token) {
        setError('Please connect your wallet first')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const { signature, message } = await signGovernanceMessage('cancel', {
          proposal_id: proposalId,
          reason,
        })

        const proposal = await governanceApi.cancelProposal(proposalId, {
          signature,
          message,
          reason,
        })
        return proposal
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to cancel proposal'
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token, isAuthenticated, signGovernanceMessage]
  )

  return { create, submit, finalize, cancel, loading, error }
}

// =============================================================================
// GOVERNANCE HEALTH
// =============================================================================

export function useGovernanceHealth() {
  const [isAvailable, setIsAvailable] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    governanceApi
      .getGovernanceHealth()
      .then((result: any) => setIsAvailable(result.governance))
      .catch(() => setIsAvailable(false))
      .finally(() => setLoading(false))
  }, [])

  return { isAvailable, loading }
}
