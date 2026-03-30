/**
 * Type definitions for Whitepaper components
 *
 * Provides strongly-typed interfaces for the whitepaper page structure,
 * navigation, and section components.
 */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Navigation item for the whitepaper table of contents
 */
export interface WhitepaperNavItem {
  /** Unique identifier matching the section id */
  id: string
  /** Display title in the navigation */
  title: string
  /** Nesting level (1 = top level, 2 = subsection) */
  level: 1 | 2
  /** Optional icon for visual hierarchy */
  icon?: LucideIcon
}

/**
 * Section configuration for the whitepaper
 */
export interface WhitepaperSectionConfig {
  /** Unique identifier used for anchor links */
  id: string
  /** Section title */
  title: string
  /** Optional subtitle or description */
  subtitle?: string
  /** Optional icon displayed next to title */
  icon?: LucideIcon
  /** Section order (for sorting) */
  order: number
}

/**
 * Props for WhitepaperLayout component
 */
export interface WhitepaperLayoutProps {
  /** Navigation items for the table of contents */
  navItems: WhitepaperNavItem[]
  /** Main content */
  children: ReactNode
  /** Optional title for the page header */
  title?: string
  /** Optional description for SEO */
  description?: string
}

/**
 * Props for WhitepaperNav component
 */
export interface WhitepaperNavProps {
  /** Navigation items to display */
  items: WhitepaperNavItem[]
  /** Currently active section id */
  activeId: string
  /** Callback when a nav item is clicked */
  onNavigate?: (id: string) => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Props for WhitepaperSection component
 */
export interface WhitepaperSectionProps {
  /** Section configuration */
  config: WhitepaperSectionConfig
  /** Section content */
  children: ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Props for WhitepaperHeader component
 */
export interface WhitepaperHeaderProps {
  /** Page title */
  title: string
  /** Page subtitle/description */
  subtitle?: string
  /** Version badge text */
  version?: string
  /** Last updated date */
  lastUpdated?: string
}

/**
 * Scroll spy hook return type
 */
export interface UseScrollSpyReturn {
  /** Currently active section id */
  activeId: string
  /** Scroll to a specific section */
  scrollTo: (id: string) => void
}

/**
 * Navigation group (for collapsible sections in nav)
 */
export interface WhitepaperNavGroup {
  /** Group title */
  title: string
  /** Items in this group */
  items: WhitepaperNavItem[]
  /** Whether group is initially expanded */
  defaultExpanded?: boolean
}
