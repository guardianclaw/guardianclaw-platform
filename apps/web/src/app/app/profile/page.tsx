'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Key, Coins, Shield, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ApiKeysManager } from '@/components/settings/api-keys-manager'
import { DataManagement } from '@/components/settings/data-management'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { BalanceDisplay } from '@/components/credits'

const tabs = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'credits', label: 'Credits & Usage', icon: Coins },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'data-privacy', label: 'Data & Privacy', icon: Shield },
] as const

type TabId = (typeof tabs)[number]['id']

export default function ProfilePage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabId | null
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Handle URL tab parameter
  useEffect(() => {
    if (tabParam && tabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your wallet, credits, and account settings
        </p>
      </div>

      {/* Sub-navigation Tabs - TOP NAVBAR */}
      <div className="mb-8 flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-3 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <ProfileSettings />}

        {activeTab === 'credits' && (
          <div className="space-y-6">
            <BalanceDisplay showDetails={true} />
            <div className="text-center">
              <Link href="/app/profile/credits" className="text-primary text-sm hover:underline">
                View full credits dashboard →
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'api-keys' && <ApiKeysManager />}

        {activeTab === 'data-privacy' && <DataManagement />}
      </div>
    </div>
  )
}
