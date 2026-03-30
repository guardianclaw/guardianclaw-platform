/**
 * Code Generator Types
 * Type definitions for the code export system
 */

/**
 * Represents a file to be included in the generated project
 */
export interface GeneratedFile {
  path: string
  content: string
}

/**
 * Agent data as stored in the database
 */
export interface AgentData {
  id: string
  name: string
  description?: string
  framework: string
  config: Record<string, unknown>
  claw_config: ClawConfig
  integration_config?: Record<string, unknown>
  flow?: FlowData
}

/**
 * GuardianClaw configuration
 */
export interface ClawConfig {
  protection_level?: string
  gates?: {
    credibility?: boolean
    avoidance?: boolean
    limits?: boolean
    worth?: boolean
  }
  modules?: Array<{
    id: string
    enabled: boolean
    config?: Record<string, unknown>
  }>
}

/**
 * Flow data structure
 */
export interface FlowData {
  nodes: Array<{
    id: string
    type: string
    data?: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
}

/**
 * Template generator interface - all templates must implement this
 */
export interface TemplateGenerator {
  /**
   * Framework identifier (must match template.id)
   */
  frameworkId: string

  /**
   * Output language
   */
  language: 'python' | 'typescript'

  /**
   * Generate project files for this template
   */
  generate(agent: AgentData): GeneratedFile[]

  /**
   * Get required environment variables
   */
  getEnvVars(): string[]

  /**
   * Get package dependencies
   */
  getDependencies(): Record<string, string>
}

/**
 * Export options
 */
export interface ExportOptions {
  includeFlow?: boolean
  format?: 'python' | 'typescript'
}
