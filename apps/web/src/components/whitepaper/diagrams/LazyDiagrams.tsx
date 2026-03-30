/**
 * LazyDiagrams - Dynamic imports for whitepaper diagram components
 *
 * Provides lazy-loaded versions of all diagram components to improve
 * initial page load performance. Diagrams are loaded on-demand when
 * they enter the viewport.
 */

'use client'

import dynamic from 'next/dynamic'
import { memo, useRef, useState, useEffect, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                            Loading Placeholder                              */
/* -------------------------------------------------------------------------- */

interface DiagramLoadingProps {
  height?: string
  label?: string
  className?: string
}

/**
 * Loading placeholder shown while diagram is loading
 */
function DiagramLoading({
  height = '400px',
  label = 'Loading diagram',
  className,
}: DiagramLoadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl',
        'border border-zinc-800 bg-zinc-900/30',
        className
      )}
      style={{ minHeight: height }}
      role="status"
      aria-label={label}
    >
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      <span className="mt-3 text-sm text-zinc-500">{label}...</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                          Intersection Observer Hook                         */
/* -------------------------------------------------------------------------- */

/**
 * Hook to detect when element is near viewport for preloading
 */
function useNearViewport(rootMargin = '200px') {
  const ref = useRef<HTMLDivElement>(null)
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNear(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [rootMargin])

  return { ref, isNear }
}

/* -------------------------------------------------------------------------- */
/*                           Lazy Wrapper Component                            */
/* -------------------------------------------------------------------------- */

interface LazyDiagramWrapperProps<P extends object> {
  component: ComponentType<P>
  props: P
  loadingHeight?: string
  loadingLabel?: string
  className?: string
}

/**
 * Wrapper that only renders diagram when near viewport
 */
function LazyDiagramWrapperInner<P extends object>({
  component: Component,
  props,
  loadingHeight,
  loadingLabel,
  className,
}: LazyDiagramWrapperProps<P>) {
  const { ref, isNear } = useNearViewport('400px')

  return (
    <div ref={ref} className={className}>
      {isNear ? (
        <Component {...props} />
      ) : (
        <DiagramLoading height={loadingHeight} label={loadingLabel} />
      )}
    </div>
  )
}

const LazyDiagramWrapper = memo(LazyDiagramWrapperInner) as typeof LazyDiagramWrapperInner

/* -------------------------------------------------------------------------- */
/*                       Dynamic Imports with Loading UI                       */
/* -------------------------------------------------------------------------- */

// FourLayerArchitecture - largest diagram, load lazily
const FourLayerArchitectureLazy = dynamic(
  () => import('./FourLayerArchitecture').then((mod) => mod.FourLayerArchitecture),
  {
    loading: () => <DiagramLoading height="500px" label="Loading architecture diagram" />,
    ssr: false, // Client-only for animations
  }
)

// CLAWProtocol - complex diagram
const CLAWProtocolLazy = dynamic(() => import('./CLAWProtocol').then((mod) => mod.CLAWProtocol), {
  loading: () => <DiagramLoading height="450px" label="Loading CLAW protocol" />,
  ssr: false,
})

// PriorityHierarchy - medium complexity
const PriorityHierarchyLazy = dynamic(
  () => import('./PriorityHierarchy').then((mod) => mod.PriorityHierarchy),
  {
    loading: () => <DiagramLoading height="400px" label="Loading priority hierarchy" />,
    ssr: false,
  }
)

// MemoryShieldFlow - complex flow diagram
const MemoryShieldFlowLazy = dynamic(
  () => import('./MemoryShieldFlow').then((mod) => mod.MemoryShieldFlow),
  {
    loading: () => <DiagramLoading height="450px" label="Loading memory shield flow" />,
    ssr: false,
  }
)

// BenchmarkResults - data-heavy component
const BenchmarkResultsLazy = dynamic(
  () => import('./BenchmarkResults').then((mod) => mod.BenchmarkResults),
  {
    loading: () => <DiagramLoading height="400px" label="Loading benchmark results" />,
    ssr: false,
  }
)

// MarketComparison - comparison table
const MarketComparisonLazy = dynamic(
  () => import('./MarketComparison').then((mod) => mod.MarketComparison),
  {
    loading: () => <DiagramLoading height="400px" label="Loading market comparison" />,
    ssr: false,
  }
)

// IntegrationGrid - large grid component
const IntegrationGridLazy = dynamic(
  () => import('./IntegrationGrid').then((mod) => mod.IntegrationGrid),
  {
    loading: () => <DiagramLoading height="500px" label="Loading integrations" />,
    ssr: false,
  }
)

// InputValidatorTree - tree visualization
const InputValidatorTreeLazy = dynamic(
  () => import('./InputValidatorTree').then((mod) => mod.InputValidatorTree),
  {
    loading: () => <DiagramLoading height="400px" label="Loading detector tree" />,
    ssr: false,
  }
)

/* -------------------------------------------------------------------------- */
/*                         Diagram Container Wrapper                           */
/* -------------------------------------------------------------------------- */

interface DiagramContainerProps {
  children: React.ReactNode
  className?: string
  /** Label for accessibility and print */
  label?: string
  /** Hides interactive controls in print mode */
  hideControlsInPrint?: boolean
}

/**
 * Wrapper for diagrams with print-friendly styles
 *
 * @example
 * ```tsx
 * <DiagramContainer label="4-Layer Architecture">
 *   <FourLayerArchitecture />
 * </DiagramContainer>
 * ```
 */
function DiagramContainer({
  children,
  className,
  label,
  hideControlsInPrint = true,
}: DiagramContainerProps) {
  return (
    <div className={cn('diagram-container', className)} role="figure" aria-label={label}>
      {hideControlsInPrint && (
        <style>{`
          @media print {
            .diagram-container button,
            .diagram-container [role="radiogroup"],
            .diagram-container .expand-collapse-controls {
              display: none !important;
            }
          }
        `}</style>
      )}
      {children}
    </div>
  )
}

export {
  // Dynamic components
  FourLayerArchitectureLazy,
  CLAWProtocolLazy,
  PriorityHierarchyLazy,
  MemoryShieldFlowLazy,
  BenchmarkResultsLazy,
  MarketComparisonLazy,
  IntegrationGridLazy,
  InputValidatorTreeLazy,
  // Container wrapper
  DiagramContainer,
  // Utilities
  LazyDiagramWrapper,
  DiagramLoading,
  useNearViewport,
}

// Re-export types for convenience
export type { DiagramLoadingProps, DiagramContainerProps }
