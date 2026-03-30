'use client'

import { memo, useMemo } from 'react'
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import { useIsEdgeActive } from '@/stores'
import { cn } from '@/lib/utils'

// Animations are defined in globals.css
// @keyframes flow-particle - for active execution particles
// @keyframes edge-flow - for dashed line flow effect

interface ExecutionEdgeProps extends EdgeProps {
  data?: {
    status?: 'idle' | 'active' | 'success' | 'error'
  }
}

function ExecutionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: ExecutionEdgeProps) {
  // Get active state from execution store
  const isActive = useIsEdgeActive(id)

  // Calculate the edge path using bezier curves for smoother lines
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Determine status from data or store
  const status = data?.status || (isActive ? 'active' : 'idle')

  // Style based on status - all edges are dashed with flow animation
  const edgeStyles = useMemo(() => {
    const baseStyle = {
      strokeWidth: 2,
      strokeDasharray: '8 4', // Dashed pattern: 8px dash, 4px gap
      ...style,
    }

    switch (status) {
      case 'active':
        return {
          ...baseStyle,
          stroke: '#eab308', // yellow-500
          strokeWidth: 3,
          strokeDasharray: '10 5',
          filter: 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.5))',
        }
      case 'success':
        return {
          ...baseStyle,
          stroke: '#22c55e', // green-500
          strokeWidth: 2,
        }
      case 'error':
        return {
          ...baseStyle,
          stroke: '#ef4444', // red-500
          strokeWidth: 2,
        }
      default:
        return {
          ...baseStyle,
          stroke: '#52525b', // zinc-600
        }
    }
  }, [status, style])

  // Generate unique IDs for SVG elements
  const particleId = `particle-${id}`
  const gradientId = `gradient-${id}`

  return (
    <>
      {/* Gradient definition for active state */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#eab308" stopOpacity="1" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* Base edge path with flow animation */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyles}
        className={cn('edge-flow-animation', status === 'active' && 'edge-flow-active')}
      />

      {/* Animated particles when active */}
      {status === 'active' && (
        <>
          {/* Multiple particles for smooth flow effect */}
          {[0, 1, 2].map((index) => (
            <circle
              key={`${particleId}-${index}`}
              r="4"
              fill="#eab308"
              className="execution-particle"
              style={{
                offsetPath: `path("${edgePath}")`,
                animationDelay: `${index * 0.4}s`,
                filter: 'drop-shadow(0 0 3px rgba(234, 179, 8, 0.8))',
              }}
            >
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="1.2s"
                repeatCount="indefinite"
                begin={`${index * 0.4}s`}
              />
            </circle>
          ))}
        </>
      )}

      {/* Success indicator pulse */}
      {status === 'success' && (
        <circle
          r="6"
          fill="#22c55e"
          cx={labelX}
          cy={labelY}
          className="animate-ping"
          style={{
            animationDuration: '1s',
            animationIterationCount: '1',
          }}
        />
      )}

      {/* Edge label for debugging (hidden by default) */}
      {process.env.NODE_ENV === 'development' && false && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-background/80 text-muted-foreground rounded px-1 text-[10px]"
          >
            {status}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const ExecutionEdge = memo(ExecutionEdgeComponent)

// Export edge types for registration
export const edgeTypes = {
  execution: ExecutionEdge,
}
