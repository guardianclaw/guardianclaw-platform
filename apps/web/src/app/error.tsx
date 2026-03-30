'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureError } from '@/lib/monitoring'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report error to monitoring service
    captureError(error, {
      component: 'ErrorBoundary',
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Error icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
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
            <div className="bg-background absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
                <span className="text-xs font-bold text-red-500">!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="mb-4 text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mb-2 text-zinc-400">
          We encountered an unexpected error. Our team has been notified.
        </p>
        {error.digest && (
          <p className="mb-8 font-mono text-sm text-zinc-500">Error ID: {error.digest}</p>
        )}

        {/* Actions */}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
            href="/"
            className="bg-muted hover:bg-muted/80 text-foreground inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Support info */}
        <div className="border-border mt-12 border-t pt-8">
          <p className="text-sm text-zinc-500">
            If the problem persists, please visit our{' '}
            <a
              href="https://github.com/guardianclaw/guardianclaw-platform/issues"
              className="text-emerald-500 hover:text-emerald-400"
            >
              GitHub Issues
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
