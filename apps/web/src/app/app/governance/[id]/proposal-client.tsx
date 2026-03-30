'use client'

import { useParams } from 'next/navigation'
import { ProposalDetail } from '@/components/governance/proposal-detail'

export function ProposalClient() {
  const params = useParams()
  const id = params.id as string

  // Ensure we have an ID before rendering to avoid hook errors in child
  if (!id) return null

  return <ProposalDetail proposalId={id} />
}
