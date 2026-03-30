'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { Header } from './header'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { LogIn, Loader2, AlertCircle } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { connected } = useWallet()
  const { isLoading, isAuthenticated, login, error, clearError } = useAuth()
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    clearError()
    try {
      await login()
    } finally {
      setSigningIn(false)
    }
  }

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="border-claw-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  // Not connected - prompt to connect wallet
  if (!connected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
            <Image
              src="/favicon.svg"
              alt="Connect wallet"
              width={80}
              height={107}
              className="opacity-30"
            />
            <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
            <p className="text-muted-foreground">Connect your Solana wallet to access this page.</p>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Home
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Connected but not authenticated - prompt to sign in
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
            <Image
              src="/favicon.svg"
              alt="Sign in"
              width={80}
              height={107}
              className="opacity-30"
            />
            <h2 className="text-xl font-semibold">Sign In Required</h2>
            <p className="text-muted-foreground">
              Your wallet is connected. Sign in to verify your identity and access this page.
            </p>

            {error && (
              <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-3 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handleSignIn}
              disabled={signingIn}
              className="bg-claw-600 hover:bg-claw-700"
            >
              {signingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In with Wallet
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  )
}
