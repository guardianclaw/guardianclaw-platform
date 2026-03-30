/**
 * Type definitions for Whitepaper UI components
 *
 * Provides strongly-typed interfaces for reusable UI components
 * used throughout the whitepaper page.
 */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/*                               DataTable Types                               */
/* -------------------------------------------------------------------------- */

/**
 * Column definition for DataTable
 */
export interface DataTableColumn {
  /** Column header text */
  header: string
  /** Column key for data access */
  accessor?: string
  /** Custom header alignment */
  align?: 'left' | 'center' | 'right'
  /** Column width (CSS value) */
  width?: string
}

/**
 * Props for DataTable component
 */
export interface DataTableProps {
  /** Column headers (simple string array or column definitions) */
  headers: string[] | DataTableColumn[]
  /** Table rows - array of cells (string or ReactNode) */
  rows: (string | ReactNode)[][]
  /** Highlight the last row (useful for totals) */
  highlightLast?: boolean
  /** Enable striped rows */
  striped?: boolean
  /** Enable sticky header */
  stickyHeader?: boolean
  /** Table caption for accessibility */
  caption?: string
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                               CodeBlock Types                               */
/* -------------------------------------------------------------------------- */

/**
 * Props for CodeBlock component
 */
export interface CodeBlockProps {
  /** Code content to display */
  code: string
  /** Programming language for syntax highlighting */
  language?: string
  /** Show line numbers */
  showLineNumbers?: boolean
  /** Lines to highlight (1-indexed) */
  highlightLines?: number[]
  /** Custom filename to display */
  filename?: string
  /** Enable copy button */
  copyable?: boolean
  /** Maximum height before scrolling */
  maxHeight?: string
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                               QuoteBox Types                                */
/* -------------------------------------------------------------------------- */

/**
 * Variant styles for QuoteBox
 */
export type QuoteBoxVariant = 'default' | 'highlight' | 'warning' | 'info'

/**
 * Props for QuoteBox component
 */
export interface QuoteBoxProps {
  /** Quote content */
  children: ReactNode
  /** Attribution/source */
  attribution?: string
  /** Optional icon */
  icon?: LucideIcon
  /** Visual variant */
  variant?: QuoteBoxVariant
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                               InfoBox Types                                 */
/* -------------------------------------------------------------------------- */

/**
 * Variant styles for InfoBox
 */
export type InfoBoxVariant = 'info' | 'warning' | 'success' | 'error' | 'tip'

/**
 * Props for InfoBox component
 */
export interface InfoBoxProps {
  /** Box title */
  title?: string
  /** Box content */
  children: ReactNode
  /** Visual variant */
  variant?: InfoBoxVariant
  /** Optional custom icon (overrides variant icon) */
  icon?: LucideIcon
  /** Collapsible content */
  collapsible?: boolean
  /** Default collapsed state */
  defaultCollapsed?: boolean
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                               StatCard Types                                */
/* -------------------------------------------------------------------------- */

/**
 * Variant styles for StatCard
 */
export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

/**
 * Props for StatCard component
 */
export interface StatCardProps {
  /** Main value to display */
  value: string | number
  /** Label describing the value */
  label: string
  /** Optional icon */
  icon?: LucideIcon
  /** Visual variant */
  variant?: StatCardVariant
  /** Trend indicator */
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                               ExtLink Types                                 */
/* -------------------------------------------------------------------------- */

/**
 * Props for ExtLink component
 */
export interface ExtLinkProps {
  /** Link URL */
  href: string
  /** Link content */
  children: ReactNode
  /** Show external icon */
  showIcon?: boolean
  /** Additional CSS classes */
  className?: string
}
