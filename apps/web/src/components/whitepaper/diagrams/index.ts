/**
 * Whitepaper diagram components - Public exports
 *
 * Re-exports all animated diagram components for the whitepaper page.
 * These components visualize GuardianClaw's architecture and processes.
 *
 * Two versions available:
 * - Regular: Immediate loading (for above-the-fold content)
 * - Lazy: Dynamic imports (for below-the-fold content, better performance)
 */

// Diagram components - Regular (immediate)
export { FourLayerArchitecture } from './FourLayerArchitecture'
export { CLAWProtocol } from './CLAWProtocol'
export { PriorityHierarchy } from './PriorityHierarchy'
export { MemoryShieldFlow } from './MemoryShieldFlow'
export { BenchmarkResults } from './BenchmarkResults'
export { MarketComparison } from './MarketComparison'
export { IntegrationGrid } from './IntegrationGrid'
export { InputValidatorTree } from './InputValidatorTree'

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
} from './LazyDiagrams'
export type { DiagramLoadingProps, DiagramContainerProps } from './LazyDiagrams'

// Types - Common
export type {
  DiagramTheme,
  DiagramState,
  FlowDirection,
  DiagramControlsProps,
  ScenarioSelectorProps,
  DiagramFlowParticleProps,
} from './types'

// Types - FourLayerArchitecture
export type {
  ArchitectureLayer,
  FourLayerArchitectureProps,
  LayerAnimationState,
  LayerCardConfig,
} from './types'

// Types - CLAWProtocol
export type { CLAWProtocolProps } from './CLAWProtocol'

// Types - PriorityHierarchy
export type { PriorityHierarchyProps } from './PriorityHierarchy'

// Types - MemoryShieldFlow
export type { MemoryShieldFlowProps } from './MemoryShieldFlow'

// Types - BenchmarkResults
export type { BenchmarkResultsProps } from './BenchmarkResults'

// Types - MarketComparison
export type { MarketComparisonProps } from './MarketComparison'

// Types - IntegrationGrid
export type { IntegrationGridProps } from './IntegrationGrid'

// Types - InputValidatorTree
export type { InputValidatorTreeProps } from './InputValidatorTree'

// Theme utilities
export { diagramThemeColors, diagramStateColors } from './types'
