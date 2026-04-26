'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Users, AlertTriangle, User, Calendar, ArrowRight, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface UserResult {
  wallet_address: string
  display_name: string | null
  plan: string
  plan_expires_at: string | null
  created_at: string
}

function PlanBadge({ plan }: { plan: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    pro: 'default',
    starter: 'secondary',
    free: 'outline',
  }

  return (
    <Badge variant={variants[plan] || 'outline'} className="capitalize">
      {plan}
    </Badge>
  )
}

function UserCard({ user, onClick }: { user: UserResult; onClick: () => void }) {
  const shortWallet = `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`
  const createdAt = new Date(user.created_at).toLocaleDateString()

  return (
    <Card className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-claw-500/10 flex h-10 w-10 items-center justify-center rounded-full">
              <User className="text-claw-500 h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.display_name || 'Anonymous'}</span>
                <PlanBadge plan={user.plan} />
              </div>
              <p className="text-muted-foreground font-mono text-sm">{shortWallet}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Joined {createdAt}</span>
              </div>
            </div>
            <ArrowRight className="text-muted-foreground h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminSupportPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchUsers = useCallback(async () => {
    if (!isAuthenticated || !searchQuery.trim()) return

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const response = await fetch(
        `${API_URL}/admin/users/search?query=${encodeURIComponent(searchQuery.trim())}`,
        {
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to search users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, searchQuery])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchUsers()
    }
  }

  const handleUserClick = (wallet: string) => {
    router.push(`/admin/support/${wallet}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Support</h2>
        <p className="text-muted-foreground">Search and manage user accounts.</p>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            User Search
          </CardTitle>
          <CardDescription>Search by wallet address (partial match supported)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter wallet address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="font-mono"
            />
            <Button
              onClick={searchUsers}
              disabled={loading || !searchQuery.trim()}
              className="bg-claw-600 hover:bg-claw-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <div className="space-y-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            <span>
              {users.length} user{users.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {users.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-1 font-medium">No users found</h3>
                <p className="text-muted-foreground text-sm">
                  Try a different search query or check the wallet address
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <UserCard
                  key={user.wallet_address}
                  user={user}
                  onClick={() => handleUserClick(user.wallet_address)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!loading && !searched && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-1 font-medium">Search for a user</h3>
            <p className="text-muted-foreground text-sm">
              Enter a wallet address above to find user accounts
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
