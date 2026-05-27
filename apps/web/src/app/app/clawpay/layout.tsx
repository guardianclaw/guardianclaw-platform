'use client'

/**
 * ClawPay dashboard shell.
 *
 * Wraps every /app/clawpay/* route in a header with product name + a tab strip
 * for the four areas: Overview, Spending Limits, Audit, Alerts. The strip is
 * driven by next/navigation usePathname so the active tab updates as the user
 * navigates.
 */

import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface TabDef {
  href: string
  label: string
  exact?: boolean
}

const TABS: TabDef[] = [
  { href: '/app/clawpay', label: 'Overview', exact: true },
  { href: '/app/clawpay/limits', label: 'Spending limits' },
  { href: '/app/clawpay/audit', label: 'Audit' },
  { href: '/app/clawpay/alerts', label: 'Alerts' },
  { href: '/app/clawpay/billing', label: 'Billing' },
  { href: '/app/clawpay/onboarding', label: 'Onboarding' },
]

function isActive(pathname: string, tab: TabDef): boolean {
  if (tab.exact) return pathname === tab.href
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}

export default function ClawpayLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="container py-8">
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-claw-500/10 text-claw-500 flex h-10 w-10 items-center justify-center rounded-lg">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ClawPay</h1>
            <p className="text-muted-foreground text-sm">
              Decision firewall for autonomous AI agent payments
            </p>
          </div>
        </div>

        <nav
          className="border-border mt-4 flex items-center gap-1 border-b"
          aria-label="ClawPay sections"
        >
          {TABS.map((tab) => {
            const active = isActive(pathname, tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-claw-500 text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main>{children}</main>
    </div>
  )
}
