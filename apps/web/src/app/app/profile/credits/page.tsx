'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Zap,
  Sparkles,
  Loader2,
  ExternalLink,
  Info,
  ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/components/providers/auth-provider'
import { BalanceDisplay, DepositModal } from '@/components/credits'
import {
  creditsApi,
  type CreditPricing,
  type DepositRecord,
  type UsageHistoryEntry,
} from '@/lib/api'

export default function CreditsPage() {
  const { connected } = useWallet()
  const { isAuthenticated } = useAuth()

  const [pricing, setPricing] = useState<CreditPricing | null>(null)
  const [deposits, setDeposits] = useState<DepositRecord[]>([])
  const [usage, setUsage] = useState<UsageHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [treasuryWallet, setTreasuryWallet] = useState<string>('')
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [balanceKey, setBalanceKey] = useState(0)

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      try {
        // Fetch pricing (public endpoint)
        const pricingData = await creditsApi.getPricing()
        setPricing(pricingData)
        if (pricingData.treasury && pricingData.treasury !== 'Not configured') {
          setTreasuryWallet(pricingData.treasury)
        }

        // Fetch history if authenticated
        if (isAuthenticated) {
          const [depositHistory, usageHistory] = await Promise.all([
            creditsApi.getHistory({ limit: 10 }),
            creditsApi.getUsage({ limit: 20 }),
          ])
          setDeposits(depositHistory.deposits)
          setUsage(usageHistory.usage)
        }
      } catch (err) {
        console.error('Failed to fetch credits data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated])

  // Refresh data after deposit
  const handleDepositSuccess = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const [depositHistory, usageHistory] = await Promise.all([
        creditsApi.getHistory({ limit: 10 }),
        creditsApi.getUsage({ limit: 20 }),
      ])
      setDeposits(depositHistory.deposits)
      setUsage(usageHistory.usage)
      setBalanceKey((k) => k + 1)
    } catch (err) {
      console.error('Failed to refresh credits data:', err)
    }
  }, [isAuthenticated])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTxSignature = (sig: string) => {
    return `${sig.slice(0, 8)}...${sig.slice(-8)}`
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/app/profile"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Profile
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Credits & Usage</h1>
        <p className="text-muted-foreground mt-2">
          Manage your pay-per-use credits for agent executions
        </p>
      </div>

      {/* Balance Card */}
      {isAuthenticated && (
        <div className="mb-8">
          <BalanceDisplay
            key={balanceKey}
            onDepositClick={() => setDepositModalOpen(true)}
            showDetails={true}
          />
        </div>
      )}

      {/* Pricing Information */}
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        {/* How it works */}
        <div className="bg-card rounded-lg border p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info className="text-primary h-5 w-5" />
            <h3 className="font-semibold">How It Works</h3>
          </div>
          <ul className="text-muted-foreground space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">1</span>
              <span>Deposit SOL, USDC, or $GCLAW to add credits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">2</span>
              <span>Each agent execution costs ${pricing?.cost_per_execution || 0.003}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">3</span>
              <span>Credits are deducted automatically on each call</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">4</span>
              <span>No subscription needed - pay only for what you use</span>
            </li>
          </ul>
        </div>

        {/* Pricing */}
        <div className="bg-card rounded-lg border p-6">
          <div className="mb-4 flex items-center gap-2">
            <Coins className="text-primary h-5 w-5" />
            <h3 className="font-semibold">Pricing</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cost per Execution</span>
              <span className="font-mono font-bold">${pricing?.cost_per_execution || 0.003}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Minimum Deposit</span>
              <span className="font-mono">
                ${pricing?.minimum_deposit || 3}
                <span className="text-muted-foreground ml-1 text-xs">
                  (~{pricing?.examples?.['$3.00_deposit'] || 1000} executions)
                </span>
              </span>
            </div>
            <div className="border-t pt-2">
              <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                <Sparkles className="mr-1 h-3 w-3" />
                20% bonus with $GCLAW
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Deposit Examples */}
      {pricing && (
        <div className="bg-muted/30 mb-8 rounded-lg border p-6">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Quick Reference</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="bg-background rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-500">$3</p>
              <p className="text-muted-foreground text-xs">
                ~{pricing.examples?.['$3.00_deposit']?.toLocaleString() || '1,000'} calls
              </p>
            </div>
            <div className="bg-background rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-500">$10</p>
              <p className="text-muted-foreground text-xs">
                ~{pricing.examples?.['$10.00_deposit']?.toLocaleString() || '3,333'} calls
              </p>
            </div>
            <div className="bg-background rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-500">$50</p>
              <p className="text-muted-foreground text-xs">
                ~{pricing.examples?.['$50.00_deposit']?.toLocaleString() || '16,666'} calls
              </p>
            </div>
            <div className="bg-background rounded-lg border-2 border-green-500/30 p-3 text-center">
              <p className="text-lg font-bold text-green-500">$3 + 20%</p>
              <p className="text-muted-foreground text-xs">
                ~{pricing.examples?.['$3.00_claw_deposit']?.toLocaleString() || '1,200'} calls
              </p>
              <Badge className="mt-1 bg-green-500/10 text-xs text-green-500">$GCLAW</Badge>
            </div>
          </div>
        </div>
      )}

      {/* History Tabs */}
      {isAuthenticated && (
        <Tabs defaultValue="deposits" className="mt-8">
          <TabsList>
            <TabsTrigger value="deposits" className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Deposits
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              Usage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits" className="mt-4">
            <div className="rounded-lg border">
              {deposits.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center">
                  <History className="mx-auto mb-3 h-8 w-8 opacity-50" />
                  <p>No deposits yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setDepositModalOpen(true)}
                    disabled={!treasuryWallet}
                  >
                    Make your first deposit
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="text-sm">{formatDate(deposit.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{deposit.token}</Badge>
                          {deposit.bonus_applied > 1 && (
                            <Badge className="ml-2 bg-green-500/10 text-green-500">
                              +{((deposit.bonus_applied - 1) * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {deposit.amount.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-500">
                          ${deposit.credits_usd.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={deposit.status === 'confirmed' ? 'default' : 'secondary'}
                            className={
                              deposit.status === 'confirmed' ? 'bg-green-500/10 text-green-500' : ''
                            }
                          >
                            {deposit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://solscan.io/tx/${deposit.tx_signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary flex items-center gap-1 text-sm hover:underline"
                          >
                            {formatTxSignature(deposit.tx_signature)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            <div className="rounded-lg border">
              {usage.length === 0 ? (
                <div className="text-muted-foreground p-8 text-center">
                  <History className="mx-auto mb-3 h-8 w-8 opacity-50" />
                  <p>No usage history yet</p>
                  <p className="mt-2 text-sm">
                    Credits will be deducted when you invoke deployed agents
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{formatDate(entry.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.event_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-500">
                          -${entry.cost_usd.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${entry.balance_after.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Not connected message */}
      {!connected && (
        <div className="bg-muted/50 mt-6 rounded-lg border p-6 text-center">
          <p className="text-muted-foreground">
            Connect your wallet to view your credits and make deposits.
          </p>
        </div>
      )}

      {/* Deposit Modal */}
      {treasuryWallet && (
        <DepositModal
          open={depositModalOpen}
          onOpenChange={setDepositModalOpen}
          treasuryWallet={treasuryWallet}
          onSuccess={handleDepositSuccess}
        />
      )}
    </div>
  )
}
