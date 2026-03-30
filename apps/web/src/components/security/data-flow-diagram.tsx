'use client'

import { motion } from 'framer-motion'

const nodes = [
  { id: 'input', label: 'User Input', x: 50, y: 150, color: '#3b82f6', width: 100 },
  { id: 'l1', label: 'L1 Validator', x: 200, y: 150, color: '#8b5cf6', width: 110 },
  { id: 'l2', label: 'L2 Seed', x: 360, y: 150, color: '#e11d48', width: 90 },
  { id: 'llm', label: 'LLM', x: 500, y: 150, color: '#f59e0b', width: 70 },
  { id: 'l3', label: 'L3 Validator', x: 620, y: 150, color: '#14b8a6', width: 110 },
  { id: 'response', label: 'Response', x: 780, y: 150, color: '#3b82f6', width: 90 },
  { id: 'l4', label: 'L4 Observer', x: 780, y: 50, color: '#ef4444', width: 110 },
  { id: 'blocked', label: 'Blocked', x: 410, y: 250, color: '#ef4444', width: 90 },
]

type EdgeType = 'normal' | 'blocked'

const edges: { from: string; to: string; type?: EdgeType }[] = [
  { from: 'input', to: 'l1' },
  { from: 'l1', to: 'l2' },
  { from: 'l2', to: 'llm' },
  { from: 'llm', to: 'l3' },
  { from: 'l3', to: 'response' },
  { from: 'response', to: 'l4' },
  { from: 'l1', to: 'blocked', type: 'blocked' },
  { from: 'l3', to: 'blocked', type: 'blocked' },
]

const tooltips: Record<string, string> = {
  input: 'Raw user input enters the pipeline',
  l1: 'Pre-AI attack detection with 700+ patterns',
  l2: 'Alignment via system prompt injection',
  llm: 'AI model processes the validated input',
  l3: 'Post-AI heuristic checking of output',
  response: 'Validated response delivered to user',
  l4: 'LLM-based transcript analysis (async)',
  blocked: 'Request rejected — attack or policy violation detected',
}

export function DataFlowDiagram() {
  const svgWidth = 930
  const svgHeight = 310

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[700px]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full"
          role="img"
          aria-label="Data flow through GuardianClaw's 4-Layer validation pipeline"
        >
          {/* Edges */}
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from)!
            const toNode = nodes.find((n) => n.id === edge.to)!
            const fromX = fromNode.x + fromNode.width
            const fromY = fromNode.y
            const toX = toNode.x
            const toY = toNode.y

            // Vertical dashed connection for L4 (async)
            if (edge.from === 'response' && edge.to === 'l4') {
              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <motion.line
                    x1={fromNode.x + fromNode.width / 2}
                    y1={fromNode.y - 20}
                    x2={toNode.x + toNode.width / 2}
                    y2={toNode.y + 20}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="text-muted-foreground/40"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  />
                </g>
              )
            }

            // Vertical dashed red edges for blocked path
            if (edge.type === 'blocked') {
              const startX = fromNode.x + fromNode.width / 2
              const startY = fromNode.y + 20
              const endX = toNode.x + toNode.width / 2
              const endY = toNode.y - 20
              return (
                <g key={`${edge.from}-${edge.to}`} opacity={0.4}>
                  <motion.line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 1.0 }}
                  />
                  {/* Downward arrow */}
                  <polygon
                    points={`${endX},${endY} ${endX - 5},${endY - 8} ${endX + 5},${endY - 8}`}
                    fill="#ef4444"
                  />
                </g>
              )
            }

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <motion.line
                  x1={fromX + 8}
                  y1={fromY}
                  x2={toX - 8}
                  y2={toY}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground/40"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                />
                {/* Arrow */}
                <polygon
                  points={`${toX - 8},${toY} ${toX - 16},${toY - 5} ${toX - 16},${toY + 5}`}
                  className="fill-muted-foreground/40"
                />
              </g>
            )
          })}

          {/* Animated particle */}
          <motion.circle
            r="4"
            className="fill-claw-500"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <animateMotion
              dur="4s"
              repeatCount="indefinite"
              path={`M ${nodes[0].x + nodes[0].width / 2} ${nodes[0].y} L ${nodes[1].x + nodes[1].width / 2} ${nodes[1].y} L ${nodes[2].x + nodes[2].width / 2} ${nodes[2].y} L ${nodes[3].x + nodes[3].width / 2} ${nodes[3].y} L ${nodes[4].x + nodes[4].width / 2} ${nodes[4].y} L ${nodes[5].x + nodes[5].width / 2} ${nodes[5].y}`}
            />
          </motion.circle>

          {/* Nodes */}
          {nodes.map((node, i) => (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <rect
                x={node.x}
                y={node.y - 20}
                width={node.width}
                height={40}
                rx={8}
                fill={node.color}
                fillOpacity={0.1}
                stroke={node.color}
                strokeWidth={1.5}
              />
              <text
                x={node.x + node.width / 2}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-[11px] font-medium"
              >
                {node.label}
              </text>
              {/* Tooltip on hover via title element */}
              <title>{tooltips[node.id]}</title>
            </motion.g>
          ))}
        </svg>
      </div>
    </div>
  )
}
