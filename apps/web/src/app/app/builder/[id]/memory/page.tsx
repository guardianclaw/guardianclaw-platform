import { MemoryPageClient } from './client'

// Allow dynamic params beyond the static 'demo'
export const dynamicParams = true

export function generateStaticParams() {
  return [{ id: 'demo' }]
}

export default function MemoryPage() {
  return <MemoryPageClient />
}
