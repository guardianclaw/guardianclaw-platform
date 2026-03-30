/**
 * Whitepaper Shared UI Components
 *
 * Reusable UI components for the whitepaper page.
 * These components follow tier-1 design patterns and are
 * optimized for dark theme with proper accessibility.
 */

// Components
export { DataTable } from './DataTable'
export { CodeBlock } from './CodeBlock'
export { QuoteBox } from './QuoteBox'
export { InfoBox } from './InfoBox'
export { StatCard } from './StatCard'
export { ExtLink } from './ExtLink'

// Types
export type {
  DataTableProps,
  DataTableColumn,
  CodeBlockProps,
  QuoteBoxProps,
  QuoteBoxVariant,
  InfoBoxProps,
  InfoBoxVariant,
  StatCardProps,
  StatCardVariant,
  ExtLinkProps,
} from './types'
