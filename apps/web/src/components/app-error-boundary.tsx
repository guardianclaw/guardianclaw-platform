'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureError } from '@/lib/monitoring'

interface AppErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
  context: string
  backLabel?: string
  backHref?: string
}

export function AppErrorBoundary({
  error,
  reset,
  context,
  backLabel = 'Back to Dashboard',
  backHref = '/app',
}: AppErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, {
      component: `ErrorBoundary:${context}`,
      extra: { digest: error.digest },
    })
  }, [error, context])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Error icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        <h2 className="mb-2 text-xl font-bold text-white">Something went wrong in {context}</h2>
        <p className="mb-2 text-sm text-zinc-400">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="mb-6 font-mono text-xs text-zinc-500">Error ID: {error.digest}</p>
        )}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Try Again
          </button>
          <Link
            href={backHref}
            className="bg-muted hover:bg-muted/80 text-foreground inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
