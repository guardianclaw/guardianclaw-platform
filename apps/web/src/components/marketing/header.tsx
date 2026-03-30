'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface NavItem {
  label: string
  href?: string
  children?: { label: string; href: string; description?: string }[]
}

const navigation: NavItem[] = [
  {
    label: 'Products',
    children: [
      {
        label: 'Memory Shield',
        href: '/products/memory-shield',
        description: 'Tamper-proof conversation history',
      },
      {
        label: 'Database Guard',
        href: '/products/database-guard',
        description: 'SQL injection prevention',
      },
      {
        label: 'Humanoid Safety',
        href: '/products/humanoid-safety',
        description: 'Physical world constraints',
      },
      {
        label: 'Fiduciary AI',
        href: '/products/fiduciary-ai',
        description: 'Financial regulation compliance',
      },
      {
        label: 'Transaction Simulator',
        href: '/products/transaction-simulator',
        description: 'Validate Solana transactions',
      },
    ],
  },
  {
    label: 'Integrations',
    href: '/integrations',
  },
  {
    label: 'Use Cases',
    children: [
      {
        label: 'Crypto & DeFi',
        href: '/use-cases/crypto',
        description: 'Secure blockchain AI agents',
      },
      {
        label: 'Enterprise',
        href: '/use-cases/enterprise',
        description: 'Compliant AI for regulated industries',
      },
      { label: 'Robotics', href: '/use-cases/robotics', description: 'Physical world safety' },
    ],
  },
  {
    label: '$GCLAW',
    children: [
      { label: 'Token Overview', href: '/token', description: 'Tokenomics, utility & parameters' },
      {
        label: 'Holder Area',
        href: '/holder',
        description: 'Governance, voting & holder benefits',
      },
      {
        label: 'Governance',
        href: '/governance',
        description: 'Constitution, process & participation',
      },
      {
        label: 'Buy $GCLAW',
        href: 'https://jup.ag/swap/SOL-GCLAW',
        description: 'Buy on Jupiter Exchange',
      },
    ],
  },
  {
    label: 'Docs',
    children: [
      { label: 'Documentation', href: '/docs', description: 'Guides, API reference & tutorials' },
      { label: 'Whitepaper', href: '/whitepaper', description: 'Technical whitepaper v2.0' },
    ],
  },
  {
    label: 'Security',
    children: [
      {
        label: 'Security Overview',
        href: '/security',
        description: 'AI Safety & Platform Security',
      },
      { label: 'Trust Center', href: '/trust', description: 'Data practices & transparency' },
      { label: 'Compliance', href: '/compliance', description: 'EU AI Act, OWASP, standards' },
      {
        label: 'Disclosure Policy',
        href: '/security/disclosure',
        description: 'Report security issues',
      },
    ],
  },
  {
    label: 'Contact',
    href: '/contact',
  },
]

export function MarketingHeader() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  return (
    <header className="bg-background/80 fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/favicon.svg"
              alt="GuardianClaw"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="text-xl font-bold">GuardianClaw</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navigation.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'text-foreground bg-muted'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      openDropdown === item.label
                        ? 'text-foreground bg-muted'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        openDropdown === item.label && 'rotate-180'
                      )}
                    />
                  </button>
                )}

                {/* Dropdown */}
                <AnimatePresence>
                  {item.children && openDropdown === item.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="bg-background absolute left-0 top-full mt-1 w-64 rounded-xl border p-2 shadow-lg"
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="hover:bg-muted block rounded-lg p-3 transition-colors"
                        >
                          <div className="text-sm font-medium">{child.label}</div>
                          {child.description && (
                            <div className="text-muted-foreground mt-0.5 text-xs">
                              {child.description}
                            </div>
                          )}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <ThemeToggle />
            <Button variant="outline" asChild>
              <Link
                href="https://jup.ag/swap/SOL-GCLAW"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy $GCLAW
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/agents">Launch App</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="hover:bg-muted rounded-lg p-2 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden md:hidden"
            >
              <div className="space-y-2 py-4">
                {navigation.map((item) => (
                  <div key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="hover:bg-muted block rounded-lg px-4 py-2 text-sm font-medium"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-muted-foreground px-4 py-2 text-sm font-medium">
                          {item.label}
                        </div>
                        {item.children?.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="hover:bg-muted block rounded-lg px-8 py-2 text-sm"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="space-y-2 px-4 pt-4">
                  <div className="mb-4 flex items-center justify-between px-2">
                    <span className="text-muted-foreground text-sm font-medium">Appearance</span>
                    <ThemeToggle />
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link
                      href="https://jup.ag/swap/SOL-GCLAW"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buy $GCLAW
                    </Link>
                  </Button>
                  <Button className="w-full" asChild>
                    <Link href="/app/agents">Launch App</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}
