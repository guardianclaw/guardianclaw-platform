'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getDocNavigation, type DocSection } from '@/lib/docs'
import { cn } from '@/lib/utils'

export function DocsSidebar() {
  const pathname = usePathname()
  const navigation = getDocNavigation()

  return (
    <nav className="w-64 flex-shrink-0">
      <div className="sticky top-24 space-y-8">
        {navigation.map((section) => (
          <div key={section.title}>
            <h4 className="text-foreground mb-3 text-sm font-semibold">{section.title}</h4>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const href = `/docs/${item.slug}`
                const isActive = pathname === href

                return (
                  <li key={item.slug}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-claw-500/10 text-claw-600 dark:text-claw-400 font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {isActive && <ChevronRight className="h-3 w-3" />}
                      <span className={cn(!isActive && 'ml-5')}>{item.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
