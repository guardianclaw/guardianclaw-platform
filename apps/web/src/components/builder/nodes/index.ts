/**
 * Custom node components for the agent builder
 */

import { InputNode } from './input-node'
import { ProcessNode } from './process-node'
import { ClawNode } from './claw-node'
import { ToolNode } from './tool-node'
import { OutputNode } from './output-node'
import { FlowNode } from './flow-node'
import { MemoryNode } from './memory-node'
import { UtilityNode } from './utility-node'

// Re-export components
export { BaseNode } from './base-node'
export { CustomHandle, SourceHandle, TargetHandle } from './custom-handle'
export { InputNode } from './input-node'
export { ProcessNode } from './process-node'
export { ClawNode } from './claw-node'
export { ToolNode } from './tool-node'
export { OutputNode } from './output-node'
export { FlowNode } from './flow-node'
export { MemoryNode } from './memory-node'
export { UtilityNode } from './utility-node'

// Node types map for ReactFlow registration
export const nodeTypes = {
  input: InputNode,
  process: ProcessNode,
  claw: ClawNode,
  tool: ToolNode,
  output: OutputNode,
  flow: FlowNode,
  memory: MemoryNode,
  utility: UtilityNode,
} as const
