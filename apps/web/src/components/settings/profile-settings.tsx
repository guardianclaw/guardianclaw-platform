'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { userApi } from '@/lib/api'
import { toast } from 'sonner'
import { WalletBalances } from './wallet-balances'
import { BalanceDisplay } from '@/components/credits'

export function ProfileSettings() {
  const { publicKey } = useWallet()
  const [profile, setProfile] = useState<{
    wallet_address: string
    created_at: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (publicKey) {
      userApi
        .getProfile()
        .then((data) => setProfile(data.profile))
        .catch(() => toast.error('Failed to load profile'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [publicKey])

  const copyWallet = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString())
      setCopied(true)
      toast.success('Wallet address copied')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-32 animate-pulse rounded-lg" />
        <div className="bg-muted h-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      </div>
    )
  }

  if (!publicKey) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">Connect your wallet to view profile settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-medium">Account Information</h3>

        <div className="space-y-4">
          <div>
            <Label>Wallet Address</Label>
            <div className="mt-1.5 flex gap-2">
              <Input value={publicKey.toString()} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={copyWallet}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <a
              href={`https://solscan.io/account/${publicKey.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground mt-1.5 inline-flex items-center gap-1 text-xs"
            >
              View on Solscan <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div>
            <Label>Member Since</Label>
            <p className="text-muted-foreground mt-1.5">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Wallet Balances */}
      <WalletBalances />

      {/* Credits Overview */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-medium">Credits Overview</h3>
        <BalanceDisplay showDetails={false} />
        <div className="mt-4 border-t pt-4">
          <a href="/app/settings/credits" className="text-primary text-sm hover:underline">
            View full credits dashboard →
          </a>
        </div>
      </div>
    </div>
  )
}
