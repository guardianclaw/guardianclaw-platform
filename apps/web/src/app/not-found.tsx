import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* 404 number with gradient */}
        <div className="relative mb-8">
          <span className="bg-gradient-to-b from-emerald-500/20 to-transparent bg-clip-text text-[180px] font-bold leading-none text-transparent">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl font-bold text-white">404</span>
          </div>
        </div>

        {/* Message */}
        <h1 className="mb-4 text-2xl font-bold text-white">Page Not Found</h1>
        <p className="mb-8 text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you
          back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
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
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to Home
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700"
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
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            View Docs
          </Link>
        </div>

        {/* Help links */}
        <div className="border-border mt-12 border-t pt-8">
          <p className="mb-4 text-sm text-zinc-500">Need help? Try these:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/products" className="text-emerald-500 hover:text-emerald-400">
              Products
            </Link>
            <Link href="/integrations" className="text-emerald-500 hover:text-emerald-400">
              Integrations
            </Link>
            <Link href="/docs/quick-start" className="text-emerald-500 hover:text-emerald-400">
              Quick Start
            </Link>
            <Link href="/token" className="text-emerald-500 hover:text-emerald-400">
              $GCLAW Token
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
