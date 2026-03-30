'use client'

import Link from 'next/link'
import { AppErrorBoundary } from '@/components/app-error-boundary'

export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <AppErrorBoundary
        error={error}
        reset={reset}
        context="the Flow Builder"
        backLabel="Back to Dashboard"
        backHref="/app"
      />
      <div className="mt-2 flex justify-center">
        <Link href="/app/agents" className="text-sm text-zinc-400 underline hover:text-zinc-300">
          Back to Agent List
        </Link>
      </div>
    </div>
  )
}
