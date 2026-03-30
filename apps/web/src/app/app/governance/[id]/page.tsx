import { ProposalClient } from './proposal-client'

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ id: 'template' }]
}

export default function ProposalPage() {
  return <ProposalClient />
}
