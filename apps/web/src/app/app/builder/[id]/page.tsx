import { redirect } from 'next/navigation'

// Allow dynamic params beyond the static 'demo'
export const dynamicParams = true

// Redirect /app/builder/[id] to /app/builder/[id]/flow
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/app/builder/${id}/flow`)
}

// Generate static paths for demo
export function generateStaticParams() {
  return [{ id: 'demo' }]
}
