/**
 * WhitepaperLayout - Main layout with sticky TOC navigation
 *
 * Provides a two-column layout with sticky table of contents on desktop
 * and collapsible navigation on mobile.
 *
 * Accessibility features:
 * - Skip links for keyboard navigation
 * - ARIA landmarks (navigation, main, complementary)
 * - Focus management for mobile nav
 * - Screen reader announcements for scroll position
 */

'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, FileText, Download, ExternalLink, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WhitepaperNav } from './WhitepaperNav'
import { useScrollSpy } from './use-scroll-spy'
import type { WhitepaperLayoutProps } from './types'

/* -------------------------------------------------------------------------- */
/*                          PDF Download URLs                                  */
/* -------------------------------------------------------------------------- */

const PDF_DOWNLOADS = [
  {
    label: 'English',
    flag: '🇺🇸',
    url: 'https://github.com/guardianclaw/guardianclaw-platform/raw/main/docs/whitepaper/WHITEPAPER_v2.0_EN.pdf',
  },
  {
    label: 'Español',
    flag: '🇪🇸',
    url: 'https://github.com/guardianclaw/guardianclaw-platform/raw/main/docs/whitepaper/WHITEPAPER_v2.0_ES.pdf',
  },
  {
    label: 'Português',
    flag: '🇧🇷',
    url: 'https://github.com/guardianclaw/guardianclaw-platform/raw/main/docs/whitepaper/WHITEPAPER_v2.0_PT.pdf',
  },
  {
    label: '한국어',
    flag: '🇰🇷',
    url: 'https://github.com/guardianclaw/guardianclaw-platform/raw/main/docs/whitepaper/WHITEPAPER_v2.0_KO.pdf',
  },
  {
    label: '简体中文',
    flag: '🇨🇳',
    url: 'https://github.com/guardianclaw/guardianclaw-platform/raw/main/docs/whitepaper/WHITEPAPER_v2.0_ZH.pdf',
  },
]

/* -------------------------------------------------------------------------- */
/*                              Skip Links Component                           */
/* -------------------------------------------------------------------------- */

/**
 * Skip links for keyboard navigation - hidden until focused
 */
function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:left-4 focus-within:top-4 focus-within:z-[100]">
      <a
        href="#main-content"
        className="bg-claw-600 focus:ring-claw-400 focus:ring-offset-background block rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#table-of-contents"
        className="bg-claw-600 focus:ring-claw-400 focus:ring-offset-background mt-2 block rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        Skip to table of contents
      </a>
    </div>
  )
}

/**
 * WhitepaperLayout - Two-column layout with navigation
 *
 * @example
 * ```tsx
 * <WhitepaperLayout
 *   navItems={[
 *     { id: 'intro', title: 'Introduction', level: 1 },
 *     { id: 'architecture', title: 'Architecture', level: 1 },
 *   ]}
 *   title="GuardianClaw Whitepaper"
 * >
 *   <WhitepaperSection config={...}>...</WhitepaperSection>
 * </WhitepaperLayout>
 * ```
 */
export function WhitepaperLayout({
  navItems,
  children,
  title = 'GuardianClaw Whitepaper',
  description,
}: WhitepaperLayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  // Memoize so the scroll spy hook never receives a new array reference on re-render
  const sectionIds = useMemo(() => navItems.map((item) => item.id), [navItems])

  const { activeId, scrollTo } = useScrollSpy({
    sectionIds,
    offset: 100,
  })

  // Handle navigation click
  const handleNavigate = (id: string) => {
    scrollTo(id)
    setIsMobileNavOpen(false)
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Skip links for keyboard navigation */}
      <SkipLinks />

      {/* Screen reader announcement for current section */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {activeId &&
          `Currently reading: ${navItems.find((item) => item.id === activeId)?.title || activeId}`}
      </div>

      {/* Mobile navigation header */}
      <div className="bg-background/95 no-print sticky top-16 z-40 border-b border-zinc-800 backdrop-blur-sm lg:hidden">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="text-claw-500 h-4 w-4" aria-hidden="true" />
            <span className="font-medium">{title}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-navigation"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileNavOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Mobile navigation dropdown */}
        <AnimatePresence>
          {isMobileNavOpen && (
            <motion.nav
              id="mobile-navigation"
              role="navigation"
              aria-label="Table of contents (mobile)"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-zinc-800"
            >
              <div className="container mx-auto max-h-[60vh] overflow-y-auto px-4 py-4">
                <WhitepaperNav items={navItems} activeId={activeId} onNavigate={handleNavigate} />
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      {/* Main layout */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 xl:gap-12">
          {/* Desktop sidebar navigation */}
          <aside
            id="table-of-contents"
            className="no-print hidden lg:block"
            role="complementary"
            aria-label="Table of contents"
          >
            <nav
              className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8 pr-4"
              role="navigation"
              aria-label="Whitepaper sections"
            >
              {/* Sidebar header */}
              <div className="mb-6 border-b border-zinc-800 pb-4">
                <h1 className="mb-1 text-lg font-bold text-white">{title}</h1>
                {description && <p className="text-sm text-zinc-500">{description}</p>}

                {/* Quick actions */}
                <div className="mt-4 flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        aria-label="Download whitepaper PDF - select language"
                      >
                        <Download className="mr-1 h-3 w-3" aria-hidden="true" />
                        PDF
                        <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      {PDF_DOWNLOADS.map((item) => (
                        <DropdownMenuItem key={item.label} asChild>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex cursor-pointer items-center gap-2"
                            aria-label={`Download whitepaper in ${item.label}`}
                          >
                            <span aria-hidden="true">{item.flag}</span>
                            <span>{item.label}</span>
                          </a>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                    <a
                      href="https://github.com/guardianclaw/guardianclaw-platform"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View source on GitHub (opens in new tab)"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                      GitHub
                    </a>
                  </Button>
                </div>
              </div>

              {/* Navigation */}
              <WhitepaperNav items={navItems} activeId={activeId} onNavigate={handleNavigate} />
            </nav>
          </aside>

          {/* Main content */}
          <main
            id="main-content"
            className="whitepaper-content min-w-0 py-8 lg:py-12"
            role="main"
            aria-label="Whitepaper content"
            tabIndex={-1}
          >
            {/* Reading progress indicator */}
            <div
              className="no-print fixed left-0 right-0 top-0 z-50 h-1"
              role="progressbar"
              aria-label="Reading progress"
              aria-valuenow={Math.round(
                ((navItems.findIndex((item) => item.id === activeId) + 1) /
                  navItems.filter((item) => item.level === 1).length) *
                  100
              )}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="bg-claw-500 h-full"
                style={{
                  transformOrigin: 'left',
                }}
                initial={{ scaleX: 0 }}
                animate={{
                  scaleX:
                    (navItems.findIndex((item) => item.id === activeId) + 1) /
                    navItems.filter((item) => item.level === 1).length,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Content wrapper with max width */}
            <div className="mx-auto max-w-3xl lg:mx-0">{children}</div>

            {/* Footer */}
            <footer className="no-print mt-16 border-t border-zinc-800 pt-8" role="contentinfo">
              <div className="flex flex-col items-center justify-between gap-4 text-sm text-zinc-500 sm:flex-row">
                <div>
                  <span>GuardianClaw Whitepaper v2.0</span>
                  <span className="mx-2" aria-hidden="true">
                    |
                  </span>
                  <span>January 2026</span>
                </div>
                <div className="flex gap-4">
                  <a
                    href="https://guardianclaw.org"
                    className="hover:text-claw-500 transition-colors"
                    aria-label="Visit GuardianClaw website"
                  >
                    guardianclaw.org
                  </a>
                  <a
                    href="https://x.com/guardianclaw_"
                    className="hover:text-claw-500 transition-colors"
                    aria-label="Follow GuardianClaw on X (formerly Twitter)"
                  >
                    @guardianclaw_
                  </a>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}

export default WhitepaperLayout
