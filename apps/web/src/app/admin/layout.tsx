'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from '@/hooks/use-auth'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  DollarSign,
  Shield,
  Users,
  BarChart3,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Wallet,
  Loader2,
  ShieldAlert,
  Menu,
  Coins,
  Vote,
  FileCheck,
  Settings2,
  History,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  dashboard: string
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard, dashboard: 'overview' },
  { label: 'Operations', href: '/admin/operations', icon: Activity, dashboard: 'operations' },
  { label: 'Business', href: '/admin/business', icon: TrendingUp, dashboard: 'business' },
  { label: 'Financial', href: '/admin/financial', icon: DollarSign, dashboard: 'financial' },
  { label: 'Credits', href: '/admin/credits', icon: Coins, dashboard: 'credits' },
  { label: 'Security', href: '/admin/security', icon: Shield, dashboard: 'security' },
  { label: 'Governance', href: '/admin/governance', icon: Vote, dashboard: 'governance' },
  { label: 'Compliance', href: '/admin/compliance', icon: FileCheck, dashboard: 'compliance' },
  { label: 'Support', href: '/admin/support', icon: Users, dashboard: 'support' },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, dashboard: 'analytics' },
  { label: 'Alerts', href: '/admin/alerts', icon: Bell, dashboard: 'alerts' },
  { label: 'System', href: '/admin/system', icon: Settings2, dashboard: 'system' },
  { label: 'Audit Log', href: '/admin/audit', icon: History, dashboard: 'audit' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, dashboard: 'roles' },
]

function AdminSidebar({
  collapsed,
  onToggle,
  hasDashboardAccess,
}: {
  collapsed: boolean
  onToggle: () => void
  hasDashboardAccess: (dashboard: string) => boolean
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'bg-card fixed left-0 top-0 z-40 h-screen border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.svg"
              alt="GuardianClaw"
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="font-semibold">Admin</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(collapsed && 'mx-auto')}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          const hasAccess = hasDashboardAccess(item.dashboard)

          if (!hasAccess) return null

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                isActive
                  ? 'bg-claw-500/10 text-claw-500'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-4 left-0 right-0 px-2">
        <Link
          href="/app"
          className={cn(
            'text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <ChevronLeft className="h-5 w-5" />
          {!collapsed && <span>Back to App</span>}
        </Link>
      </div>
    </aside>
  )
}

function AdminHeader({
  role,
  sidebarCollapsed,
  onMenuClick,
}: {
  role: string | null
  sidebarCollapsed: boolean
  onMenuClick: () => void
}) {
  return (
    <header
      className={cn(
        'bg-background/95 fixed right-0 top-0 z-30 h-16 border-b backdrop-blur transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">GuardianClaw Admin</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">
            Role: <span className="text-foreground font-medium">{role || 'Unknown'}</span>
          </span>
        </div>
      </div>
    </header>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { connected } = useWallet()
  const { isLoading: authLoading, isAuthenticated, login } = useAuth()
  const { isLoading: adminLoading, isAdmin, role, error, hasDashboardAccess } = useAdminAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try {
      await login()
    } finally {
      setSigningIn(false)
    }
  }

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-claw-500 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  // Not connected
  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
            <Wallet className="text-muted-foreground h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Connect your Solana wallet to access the admin dashboard.
          </p>
          <Button onClick={() => router.push('/')} variant="outline">
            Go to Home
          </Button>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
          <div className="bg-claw-500/10 flex h-16 w-16 items-center justify-center rounded-full">
            <LogIn className="text-claw-500 h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <p className="text-muted-foreground">
            Sign in with your wallet to access the admin dashboard.
          </p>
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
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
          <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
            <ShieldAlert className="text-destructive h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            {error || 'You do not have admin access to this dashboard.'}
          </p>
          <Button onClick={() => router.push('/app')} variant="outline">
            Go to App
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        hasDashboardAccess={hasDashboardAccess}
      />
      <AdminHeader
        role={role}
        sidebarCollapsed={sidebarCollapsed}
        onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={cn(
          'min-h-screen pt-16 transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
