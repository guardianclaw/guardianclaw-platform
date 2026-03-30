import Link from 'next/link'
import { Github, Twitter } from 'lucide-react'

const footerLinks = {
  products: [
    { label: 'Memory Shield', href: '/products/memory-shield' },
    { label: 'Database Guard', href: '/products/database-guard' },
    { label: 'Humanoid Safety', href: '/products/humanoid-safety' },
    { label: 'Fiduciary AI', href: '/products/fiduciary-ai' },
    { label: 'Transaction Simulator', href: '/products/transaction-simulator' },
  ],
  resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Whitepaper', href: '/whitepaper' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'API Reference', href: '/docs/api/validation' },
    { label: 'GitHub', href: 'https://github.com/guardianclaw/guardianclaw-platform' },
  ],
  company: [
    { label: 'Whitepaper', href: '/whitepaper' },
    { label: 'Blog', href: '/blog' },
    { label: '$GCLAW Token', href: '/token' },
    { label: 'Contact', href: '/contact' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
    { label: 'Trust Center', href: '/trust' },
  ],
}

const socialLinks = [
  { label: 'GitHub', href: 'https://github.com/guardianclaw/guardianclaw-platform', icon: Github },
  { label: 'Twitter', href: 'https://x.com/guardianclaw_', icon: Twitter },
]

export function MarketingFooter() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <img
                src="/favicon.svg"
                alt="GuardianClaw"
                width={20}
                height={20}
                className="rounded-full opacity-70"
              />
              <span className="text-xl font-bold">GuardianClaw</span>
            </Link>
            <p className="text-muted-foreground mb-4 max-w-xs text-sm">
              Decision Firewall for AI Agents. Build, deploy, and protect AI systems with
              confidence.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bg-muted rounded-lg p-2 transition-colors"
                  aria-label={link.label}
                >
                  <link.icon className="text-muted-foreground h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Products</h3>
            <ul className="space-y-3">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    {...(link.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} GuardianClaw Team. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/compliance"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                EU AI Act Compliant
              </Link>
              <Link
                href="/security"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Open Source Security
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
