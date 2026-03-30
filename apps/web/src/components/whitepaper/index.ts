/**
 * Whitepaper components - Public exports
 *
 * Re-exports all whitepaper-related components for easy importing.
 *
 * Two versions of diagram components:
 * - Regular: Immediate loading (for above-the-fold or when needed immediately)
 * - Lazy: Dynamic imports with code splitting (for below-the-fold, better performance)
 */

// Layout components
export { WhitepaperLayout } from './WhitepaperLayout'
export { WhitepaperNav } from './WhitepaperNav'
export { WhitepaperHeader } from './WhitepaperHeader'
export { WhitepaperSection, WhitepaperSubsection, WhitepaperDivider } from './WhitepaperSection'

// Shared UI components
export { DataTable, CodeBlock, QuoteBox, InfoBox, StatCard, ExtLink } from './shared'

// Diagram components - Regular (immediate loading)
export {
  FourLayerArchitecture,
  CLAWProtocol,
  PriorityHierarchy,
  MemoryShieldFlow,
  BenchmarkResults,
  MarketComparison,
  IntegrationGrid,
  InputValidatorTree,
} from './diagrams'

// Diagram components - Lazy (dynamic imports for performance)
export {
  FourLayerArchitectureLazy,
  CLAWProtocolLazy,
  PriorityHierarchyLazy,
  MemoryShieldFlowLazy,
  BenchmarkResultsLazy,
  MarketComparisonLazy,
  IntegrationGridLazy,
  InputValidatorTreeLazy,
  // Container wrapper for print-friendly diagrams
  DiagramContainer,
  // Utilities for custom lazy loading
  LazyDiagramWrapper,
  DiagramLoading,
  useNearViewport,
} from './diagrams'

// Content components
export { sectionContent } from './whitepaper-content'

// Page content (client component for server component pages)
// Note: WhitepaperPageContent is self-contained with no props
export { WhitepaperPageContent } from './WhitepaperPageContent'

// Hooks
export { useScrollSpy } from './use-scroll-spy'

// Types - Layout
export type {
  WhitepaperNavItem,
  WhitepaperSectionConfig,
  WhitepaperLayoutProps,
  WhitepaperNavProps,
  WhitepaperSectionProps,
  WhitepaperHeaderProps,
  WhitepaperNavGroup,
  UseScrollSpyReturn,
} from './types'

// Types - Shared UI
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
} from './shared'

// Types - Diagrams
export type {
  DiagramTheme,
  DiagramState,
  FlowDirection,
  ArchitectureLayer,
  FourLayerArchitectureProps,
  LayerAnimationState,
  DiagramControlsProps,
  ScenarioSelectorProps,
  CLAWProtocolProps,
  PriorityHierarchyProps,
  MemoryShieldFlowProps,
  BenchmarkResultsProps,
  MarketComparisonProps,
  IntegrationGridProps,
  InputValidatorTreeProps,
} from './diagrams'

// Diagram utilities
export { diagramThemeColors, diagramStateColors } from './diagrams'

// Lazy loading utilities types
export type { DiagramLoadingProps, DiagramContainerProps } from './diagrams'
