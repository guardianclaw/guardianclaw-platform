/**
 * Layout validation tests for template-utils
 *
 * These tests verify that the node positions are reasonable
 * and will render correctly in the React Flow canvas.
 */

import { describe, it, expect } from 'vitest'
import { convertTemplateToFlow } from './template-utils'
import { TEMPLATES, getTemplateById } from './templates'

// React Flow canvas defaults
const CANVAS_MIN_X = 0
const CANVAS_MIN_Y = 0
const CANVAS_MAX_X = 2000 // Reasonable max for initial view
const CANVAS_MAX_Y = 800

// Node dimensions (approximate)
const NODE_WIDTH = 200
const NODE_HEIGHT = 80

describe('Layout validation', () => {
  describe('Node positions are within reasonable bounds', () => {
    TEMPLATES.forEach((template) => {
      it(`${template.name} nodes should be within canvas bounds`, () => {
        const flow = convertTemplateToFlow(template)

        flow.nodes.forEach((node: any) => {
          expect(node.position.x).toBeGreaterThanOrEqual(CANVAS_MIN_X)
          expect(node.position.x).toBeLessThanOrEqual(CANVAS_MAX_X)
          expect(node.position.y).toBeGreaterThanOrEqual(CANVAS_MIN_Y)
          expect(node.position.y).toBeLessThanOrEqual(CANVAS_MAX_Y)
        })
      })
    })
  })

  describe('Nodes do not overlap', () => {
    TEMPLATES.forEach((template) => {
      it(`${template.name} nodes should not overlap`, () => {
        const flow = convertTemplateToFlow(template)

        for (let i = 0; i < flow.nodes.length; i++) {
          for (let j = i + 1; j < flow.nodes.length; j++) {
            const node1 = flow.nodes[i] as any
            const node2 = flow.nodes[j] as any

            // Check if nodes overlap
            const overlapX = Math.abs(node1.position.x - node2.position.x) < NODE_WIDTH
            const overlapY = Math.abs(node1.position.y - node2.position.y) < NODE_HEIGHT

            // Nodes should not overlap in both dimensions
            const overlap = overlapX && overlapY
            expect(overlap).toBe(false)
          }
        }
      })
    })
  })

  describe('Flow direction is left-to-right', () => {
    it('OpenAI Agents flow should progress left to right', () => {
      const template = getTemplateById('openai_agents')!
      const flow = convertTemplateToFlow(template)

      // Get nodes in topological order by following edges
      const nodeMap = new Map(flow.nodes.map((n: any) => [n.id, n]))

      // Input should be leftmost
      const inputNode = nodeMap.get('input-1') as any
      const outputNode = nodeMap.get('output-1') as any

      expect(inputNode.position.x).toBeLessThan(outputNode.position.x)
    })

    it('All templates should have input before output', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        const inputNodes = flow.nodes.filter((n: any) => n.type === 'input')
        const outputNodes = flow.nodes.filter((n: any) => n.type === 'output')

        if (inputNodes.length > 0 && outputNodes.length > 0) {
          const minInputX = Math.min(...inputNodes.map((n: any) => n.position.x))
          const maxOutputX = Math.max(...outputNodes.map((n: any) => n.position.x))

          expect(minInputX).toBeLessThan(maxOutputX)
        }
      })
    })
  })

  describe('Spacing is consistent', () => {
    it('Horizontal spacing between layers should be ~250px', () => {
      const template = getTemplateById('openai_agents')!
      const flow = convertTemplateToFlow(template)

      // Sort nodes by x position
      const sortedNodes = [...flow.nodes].sort((a: any, b: any) => a.position.x - b.position.x)

      // Check spacing between consecutive layers
      const spacings: number[] = []
      for (let i = 1; i < sortedNodes.length; i++) {
        const spacing = sortedNodes[i].position.x - sortedNodes[i - 1].position.x
        if (spacing > 0) {
          spacings.push(spacing)
        }
      }

      // All spacings should be around 250px (allow 50px variance)
      spacings.forEach((spacing) => {
        expect(spacing).toBeGreaterThanOrEqual(200)
        expect(spacing).toBeLessThanOrEqual(300)
      })
    })
  })

  describe('Specific layout verification', () => {
    it('OpenAI Agents layout should match expected positions', () => {
      const template = getTemplateById('openai_agents')!
      const flow = convertTemplateToFlow(template)

      // Expected layout: 5 nodes in a row
      // Layer 0: input (x=100)
      // Layer 1: claw-in (x=350)
      // Layer 2: llm (x=600)
      // Layer 3: claw-out (x=850)
      // Layer 4: output (x=1100)

      const nodeMap = new Map(flow.nodes.map((n: any) => [n.id, n]))

      const input = nodeMap.get('input-1') as any
      const clawIn = nodeMap.get('claw-in') as any
      const llm = nodeMap.get('llm-1') as any
      const clawOut = nodeMap.get('claw-out') as any
      const output = nodeMap.get('output-1') as any

      // Verify x positions are in correct order with ~250px spacing
      expect(input.position.x).toBe(100)
      expect(clawIn.position.x).toBe(350)
      expect(llm.position.x).toBe(600)
      expect(clawOut.position.x).toBe(850)
      expect(output.position.x).toBe(1100)

      // All should be on the same y-line (single row)
      expect(input.position.y).toBe(200)
      expect(clawIn.position.y).toBe(200)
      expect(llm.position.y).toBe(200)
      expect(clawOut.position.y).toBe(200)
      expect(output.position.y).toBe(200)
    })

    it('Coinbase layout with fiduciary should be correctly positioned', () => {
      const template = getTemplateById('coinbase_agentkit')!
      const flow = convertTemplateToFlow(template)

      // Coinbase has 6 nodes: input -> claw -> fiduciary -> llm -> claw -> output
      expect(flow.nodes.length).toBe(6)

      // Verify left-to-right progression
      const sortedNodes = [...flow.nodes].sort((a: any, b: any) => a.position.x - b.position.x)

      expect(sortedNodes[0].type).toBe('input')
      expect(sortedNodes[5].type).toBe('output')
    })
  })

  describe('Y-axis distribution for parallel nodes', () => {
    it('Nodes in same layer should be vertically distributed', () => {
      // For templates with branching (if any), verify y-distribution
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        // Group nodes by x position (layer)
        const layers = new Map<number, any[]>()
        flow.nodes.forEach((node: any) => {
          const x = Math.round(node.position.x / 50) * 50 // Round to nearest 50
          if (!layers.has(x)) {
            layers.set(x, [])
          }
          layers.get(x)!.push(node)
        })

        // For layers with multiple nodes, verify they don't have same y
        layers.forEach((nodesInLayer) => {
          if (nodesInLayer.length > 1) {
            const yPositions = nodesInLayer.map((n: any) => n.position.y)
            const uniqueY = new Set(yPositions)
            expect(uniqueY.size).toBe(yPositions.length)
          }
        })
      })
    })
  })
})
