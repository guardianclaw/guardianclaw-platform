'use client'

import { useCallback, useRef, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  useNodesInitialized,
  BackgroundVariant,
  ConnectionMode,
  SelectionMode,
  type Connection,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useFlowStore, useNodes, useEdges, useNodeStates, FlowNode, FlowEdge } from '@/stores'
import { NodePalette } from './node-palette'
import { GuardianClawWarningBanner } from './claw-warning-banner'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'

// Node type colors for minimap
const nodeColor = (node: FlowNode) => {
  switch (node.type) {
    case 'input':
      return '#3b82f6' // blue
    case 'process':
      return '#8b5cf6' // purple
    case 'claw':
      return '#e11d48' // crimson (brand)
    case 'tool':
      return '#f59e0b' // amber
    case 'flow':
      return '#f97316' // orange
    case 'memory':
      return '#06b6d4' // cyan
    case 'utility':
      return '#6b7280' // gray
    case 'output':
      return '#ef4444' // red
    default:
      return '#6b7280' // gray
  }
}

export function BuilderCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, setViewport, getViewport, fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const fitViewCalledRef = useRef(false)

  // Fit view only after nodes have been measured (have width/height).
  // This prevents edges from rendering at wrong positions when
  // navigating back to the flow page after visiting other tabs.
  useEffect(() => {
    if (nodesInitialized && !fitViewCalledRef.current) {
      fitViewCalledRef.current = true
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, maxZoom: 1.5 })
      })
    }
  }, [nodesInitialized, fitView])

  // Reset fitView flag when nodes are cleared (page unmount/remount cycle)
  useEffect(() => {
    if (!nodesInitialized) {
      fitViewCalledRef.current = false
    }
  }, [nodesInitialized])

  // Store state and actions
  const nodes = useNodes()
  const edges = useEdges()
  const nodeStates = useNodeStates()
  const onNodesChange = useFlowStore((state) => state.onNodesChange)
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange)
  const onConnect = useFlowStore((state) => state.onConnect)
  const addNode = useFlowStore((state) => state.addNode)
  const selectNode = useFlowStore((state) => state.selectNode)
  const selectEdge = useFlowStore((state) => state.selectEdge)
  const setStoreViewport = useFlowStore((state) => state.setViewport)
  const setNodes = useFlowStore((state) => state.setNodes)
  const setEdges = useFlowStore((state) => state.setEdges)

  // Apply execution status to nodes
  const nodesWithStatus = useMemo(() => {
    return nodes.map((node) => {
      const executionStatus = nodeStates[node.id]
      if (executionStatus && executionStatus !== 'idle') {
        return {
          ...node,
          data: {
            ...node.data,
            executionStatus,
          },
          // Add CSS class for styling
          className: `execution-status-${executionStatus}`,
        }
      }
      return node
    })
  }, [nodes, nodeStates])

  // Handle drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow/type')
      const label = event.dataTransfer.getData('application/reactflow/label')
      const subtype = event.dataTransfer.getData('application/reactflow/subtype')

      if (!type) return

      // Get the position where the node was dropped
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Create new node based on type
      const newNode = createNodeByType(type, subtype, label, position)
      addNode(newNode)
    },
    [screenToFlowPosition, addNode]
  )

  // Handle selection changes
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes.length > 0) {
        selectNode(selectedNodes[0].id)
      } else if (selectedEdges.length > 0) {
        selectEdge(selectedEdges[0].id)
      } else {
        selectNode(null)
        selectEdge(null)
      }
    },
    [selectNode, selectEdge]
  )

  // Validate connections before they're created
  const isValidConnection = useCallback(
    (connection: FlowEdge | Connection) => {
      // No self-loops
      if (connection.source === connection.target) return false
      // No duplicate edges
      if (edges.some((e) => e.source === connection.source && e.target === connection.target))
        return false
      // Output nodes can't be sources
      const sourceNode = nodes.find((n) => n.id === connection.source)
      if (sourceNode?.type === 'output') return false
      // Input nodes can't be targets
      const targetNode = nodes.find((n) => n.id === connection.target)
      if (targetNode?.type === 'input') return false
      return true
    },
    [edges, nodes]
  )

  // Handle viewport changes
  const onMoveEnd = useCallback(() => {
    const viewport = getViewport()
    setStoreViewport(viewport)
  }, [getViewport, setStoreViewport])

  // Create minimal safety flow: INPUT → GCLAW → LLM → OUTPUT
  const handleCreateMinimalFlow = useCallback(() => {
    const spacing = 250
    const startX = 100
    const startY = 200

    const newNodes = [
      createNodeByType('input', 'user_message', 'User Message', { x: startX, y: startY }),
      createNodeByType('claw', 'input_validator', 'Input Validator', {
        x: startX + spacing,
        y: startY,
      }),
      createNodeByType('process', 'llm_call', 'LLM Call', { x: startX + spacing * 2, y: startY }),
      createNodeByType('output', 'response', 'Response', { x: startX + spacing * 3, y: startY }),
    ]

    const newEdges: FlowEdge[] = [
      {
        id: `e_${newNodes[0].id}_${newNodes[1].id}`,
        source: newNodes[0].id,
        target: newNodes[1].id,
        type: 'execution',
      },
      {
        id: `e_${newNodes[1].id}_${newNodes[2].id}`,
        source: newNodes[1].id,
        target: newNodes[2].id,
        type: 'execution',
      },
      {
        id: `e_${newNodes[2].id}_${newNodes[3].id}`,
        source: newNodes[2].id,
        target: newNodes[3].id,
        type: 'execution',
      },
    ]

    setNodes(newNodes)
    setEdges(newEdges)

    // Fit view after nodes render
    requestAnimationFrame(() => {
      fitView({ padding: 0.3, maxZoom: 1.2 })
    })
  }, [setNodes, setEdges, fitView])

  return (
    <div ref={reactFlowWrapper} className="relative h-full w-full">
      <GuardianClawWarningBanner />
      <ReactFlow
        nodes={nodesWithStatus}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onConnect={onConnect as OnConnect}
        isValidConnection={isValidConnection}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onSelectionChange={onSelectionChange}
        onMoveEnd={onMoveEnd}
        connectionMode={ConnectionMode.Loose}
        selectionMode={SelectionMode.Partial}
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'execution',
          animated: false, // Animation handled by CSS
          style: {
            stroke: '#52525b',
            strokeWidth: 2,
            strokeDasharray: '8 4', // Dashed line pattern
          },
        }}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift']}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        {/* Grid background */}
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />

        {/* Controls panel */}
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          position="bottom-right"
          className="bg-background border shadow-sm"
        />

        {/* Minimap */}
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(0, 0, 0, 0.2)"
          position="bottom-left"
          className="bg-background/80 border shadow-sm"
          pannable
          zoomable
        />

        {/* Node palette */}
        <Panel position="top-left" className="m-4">
          <NodePalette />
        </Panel>

        {/* Empty state with onboarding */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="m-0 mt-24">
            <div className="bg-background/90 mx-auto max-w-lg rounded-xl border border-dashed p-8 text-center">
              <p className="text-foreground mb-1 text-lg font-semibold">Build your agent flow</p>
              <p className="text-muted-foreground mb-5 text-sm">
                Drag nodes from the palette, or start with a basic safety flow
              </p>

              {/* Minimal flow diagram */}
              <div className="mb-5 flex items-center justify-center gap-2">
                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  INPUT
                </span>
                <span className="text-muted-foreground text-xs">&rarr;</span>
                <span className="rounded-md border border-amber-500/20 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
                  GCLAW
                </span>
                <span className="text-muted-foreground text-xs">&rarr;</span>
                <span className="rounded-md border border-blue-500/20 bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-400">
                  LLM
                </span>
                <span className="text-muted-foreground text-xs">&rarr;</span>
                <span className="rounded-md border border-rose-500/20 bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-400">
                  OUTPUT
                </span>
              </div>

              <button
                onClick={() => handleCreateMinimalFlow()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Create basic flow
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

// Helper function to create nodes by type
function createNodeByType(
  type: string,
  subtype: string,
  label: string,
  position: { x: number; y: number }
): FlowNode {
  const id = `${type}_${Date.now()}`

  switch (type) {
    case 'input':
      return {
        id,
        type,
        position,
        data: {
          label,
          inputType: subtype as 'user_message' | 'api_call' | 'webhook',
          config: {},
        },
      }

    case 'process':
      return {
        id,
        type,
        position,
        data: {
          label,
          processType: subtype as 'llm_call' | 'condition',
          config: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 1024,
          },
        },
      }

    case 'claw': {
      // v2.25 Layer Architecture
      const layerSubtypes = ['input_validator', 'seed_injection', 'output_validator', 'observer']
      const isLayer = layerSubtypes.includes(subtype)

      if (isLayer) {
        // Create layer node with appropriate config
        const layerType = subtype as
          | 'input_validator'
          | 'seed_injection'
          | 'output_validator'
          | 'observer'
        return {
          id,
          type,
          position,
          data: {
            label,
            layerType,
            // Default configurations per layer type
            ...(layerType === 'input_validator' && {
              l1Config: {
                mode: 'moderate',
                enabledDetectors: {
                  pattern: true,
                  escalation: true,
                  framing: true,
                  harmful_request: true,
                  intent_signal: false,
                  safe_agent: false,
                  embedding: false,
                  benign_context: true,
                },
                threshold: 70,
              },
            }),
            ...(layerType === 'seed_injection' && {
              l2Config: {
                seedLevel: 'standard',
                customSeed: '',
                appendMode: true,
              },
            }),
            ...(layerType === 'output_validator' && {
              l3Config: {
                mode: 'moderate',
                enabledGates: {
                  credibility: true,
                  avoidance: true,
                  limits: true,
                  worth: true,
                },
              },
            }),
            ...(layerType === 'observer' && {
              l4Config: {
                enabled: true,
                provider: 'openai',
                model: 'gpt-4o-mini',
                fallbackPolicy: 'ALLOW_IF_L2_PASSED',
                maxRetries: 2,
                retryDelayMs: 1000,
              },
            }),
          },
        }
      }

      // Legacy CLAW gates (v2.18 compatibility)
      return {
        id,
        type,
        position,
        data: {
          label,
          gateType: subtype as 'credibility' | 'avoidance' | 'limits' | 'worth' | 'all',
          config: {
            enabled: true,
            strictMode: false,
          },
        },
      }
    }

    case 'tool':
      return {
        id,
        type,
        position,
        data: {
          label,
          toolType: subtype as 'web_search' | 'code_exec' | 'api_request' | 'database',
          config: {
            timeout: 30000,
          },
        },
      }

    case 'flow':
      return {
        id,
        type,
        position,
        data: {
          label,
          flowType: subtype as 'router' | 'merge' | 'loop',
          config: {
            // Router: conditions array
            // Merge: mode (first, all, concat)
            // Loop: maxIterations
            ...(subtype === 'router' && { conditions: [], defaultTarget: null }),
            ...(subtype === 'merge' && { mode: 'first', waitForAll: false }),
            ...(subtype === 'loop' && { maxIterations: 100, collectResults: true }),
          },
        },
      }

    case 'memory':
      return {
        id,
        type,
        position,
        data: {
          label,
          memoryType: subtype as 'buffer' | 'vector' | 'summary',
          config: {
            // Buffer: operation, bufferSize
            // Vector: operation, topK, threshold
            // Summary: model, maxLength
            ...(subtype === 'buffer' && { operation: 'get', bufferSize: 10 }),
            ...(subtype === 'vector' && { operation: 'search', topK: 5, threshold: 0.7 }),
            ...(subtype === 'summary' && { model: 'gpt-4o-mini', maxLength: 500 }),
          },
        },
      }

    case 'utility':
      return {
        id,
        type,
        position,
        data: {
          label,
          utilityType: subtype as 'delay' | 'log',
          config: {
            // Delay: seconds
            // Log: level, message, includeData
            ...(subtype === 'delay' && { seconds: 1 }),
            ...(subtype === 'log' && { level: 'info', message: '', includeData: false }),
          },
        },
      }

    case 'output': {
      const socialSubtypes = ['twitter_post', 'discord_message', 'telegram_message']
      const isSocial = socialSubtypes.includes(subtype)

      // Social config defaults per platform
      const socialConfigDefaults: Record<string, Record<string, unknown>> = {
        twitter_post: { credentialId: '', autoSend: false },
        discord_message: { credentialId: '', channelId: '', embedFormat: false, autoSend: false },
        telegram_message: {
          credentialId: '',
          chatId: '',
          parseMode: 'HTML',
          disableNotification: false,
          autoSend: false,
        },
      }

      return {
        id,
        type,
        position,
        data: {
          label,
          outputType: subtype as
            | 'response'
            | 'webhook'
            | 'store'
            | 'twitter_post'
            | 'discord_message'
            | 'telegram_message',
          config: {
            format: 'text',
          },
          ...(isSocial && { socialConfig: socialConfigDefaults[subtype] }),
        },
      }
    }

    default:
      // Fallback should not happen if all node types are handled
      // Log warning for debugging
      console.warn(`Unknown node type: ${type}, creating as input node`)
      return {
        id,
        type: 'input',
        position,
        data: {
          label,
          inputType: 'user_message',
          config: {},
        },
      }
  }
}
