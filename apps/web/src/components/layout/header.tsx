'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Loader2, User, LogOut } from 'lucide-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/app/agents', label: 'Agents' },
  { href: '/docs', label: 'Docs' },
]

export function Header() {
  const pathname = usePathname()
  const { connected } = useWallet()
  const { isAuthenticated, isLoading, profile, logout, wallet } = useAuth()

  // Show signing indicator when wallet connected but not yet authenticated
  const isSigningIn = connected && !isAuthenticated && isLoading

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center gap-2">
          <img
            src="/favicon.svg"
            alt="GuardianClaw"
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="hidden text-lg font-bold sm:inline-block">GuardianClaw</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'hover:text-foreground/80 text-sm font-medium transition-colors',
                pathname === item.href || pathname?.startsWith(item.href + '/')
                  ? 'text-foreground'
                  : 'text-foreground/60'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Section */}
        <div className="ml-auto flex items-center gap-4">
          {/* Profile Link - when authenticated */}
          {isAuthenticated && (
            <Link
              href="/app/profile"
              className={cn(
                'hover:text-foreground/80 hidden items-center gap-2 text-sm font-medium transition-colors sm:flex',
                pathname?.startsWith('/app/profile') ? 'text-foreground' : 'text-foreground/60'
              )}
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
          )}

          <ThemeToggle />

          {/* Wallet & Auth */}
          <div className="hidden items-center gap-2 sm:flex">
            <WalletMultiButton />

            {/* Signing indicator - shows briefly while auto-signing */}
            {isSigningIn && (
              <span className="text-muted-foreground flex items-center text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </span>
            )}
          </div>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {navItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {isSigningIn && (
                <DropdownMenuItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </DropdownMenuItem>
              )}
              {isAuthenticated && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/app/profile">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
