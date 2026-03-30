export default function Loading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Animated logo/spinner */}
        <div className="relative">
          {/* Outer ring */}
          <div className="h-16 w-16 rounded-full border-2 border-zinc-800" />

          {/* Spinning arc */}
          <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-emerald-500" />

          {/* GuardianClaw eyes */}
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <div className="h-1.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <div className="h-1.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className="text-sm text-zinc-400">Loading...</p>
        </div>
      </div>
    </div>
  )
}
