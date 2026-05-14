/**
 * @fileoverview UI helper functions
 *
 * Shared helper functions for UI components, including
 * icon mappings, risk level utilities, and type guards.
 *
 * @author GuardianClaw Team
 * @license MIT
 */

import type React from 'react';
import type {
  AgentAction,
  MCPToolCall,
  MCPServer,
  RiskLevel,
} from '../../types';

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if an action is AgentAction
 */
export function isAgentAction(
  action: AgentAction | MCPToolCall
): action is AgentAction {
  return 'type' in action && 'agentName' in action;
}

/**
 * Type guard to check if an action is MCPToolCall
 */
export function isMCPToolCall(
  action: AgentAction | MCPToolCall
): action is MCPToolCall {
  return 'tool' in action && 'serverName' in action;
}

// =============================================================================
// ACTION DISPLAY INFO
// =============================================================================

export interface ActionDisplayInfo {
  type: string;
  sourceName: string;
  description: string;
  riskLevel: RiskLevel;
  estimatedValueUsd?: number;
  params: Record<string, unknown>;
  clawResult: {
    credibility: { passed: boolean; score: number; issues: string[] };
    avoidance: { passed: boolean; score: number; issues: string[] };
    limits: { passed: boolean; score: number; issues: string[] };
    worth: { passed: boolean; score: number; issues: string[] };
    overall: boolean;
    summary: string;
  };
}

/**
 * Extract display information from an action (AgentAction or MCPToolCall)
 */
export function getActionDisplayInfo(
  action: AgentAction | MCPToolCall
): ActionDisplayInfo {
  if (isAgentAction(action)) {
    return {
      type: action.type,
      sourceName: action.agentName,
      description: action.description,
      riskLevel: action.riskLevel,
      estimatedValueUsd: action.estimatedValueUsd,
      params: action.params,
      clawResult: action.clawResult,
    };
  }
  // MCPToolCall
  return {
    type: action.tool,
    sourceName: action.serverName,
    description: `Tool call: ${action.tool}`,
    riskLevel: action.riskLevel,
    estimatedValueUsd: undefined,
    params: action.arguments,
    clawResult: action.clawResult,
  };
}

// =============================================================================
// ICON HELPERS
// =============================================================================

const AGENT_TYPE_ICONS: Record<string, string> = {
  elizaos: '🎭',
  openai_agents: '🤖',
  google_adk: '🔷',
  voltagent: '⚡',
  openclaw: '🛡️',
  custom: '⚙️',
};

/**
 * Get icon for agent type
 */
export function getAgentIcon(type: string): string {
  return AGENT_TYPE_ICONS[type] || '🤖';
}

const TRANSPORT_ICONS: Record<string, string> = {
  http: '🌐',
  websocket: '🔌',
  stdio: '💻',
};

/**
 * Get icon for transport type
 */
export function getTransportIcon(transport: string): string {
  return TRANSPORT_ICONS[transport] || '🔧';
}

const RISK_ICONS: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

/**
 * Get icon for risk level
 */
export function getRiskIcon(level: RiskLevel | string): string {
  return RISK_ICONS[level as RiskLevel] || '⚪';
}

const DECISION_ICONS: Record<string, string> = {
  auto: '🤖',
  manual: '👤',
};

/**
 * Get icon for decision method
 */
export function getDecisionIcon(method: 'auto' | 'manual'): string {
  return DECISION_ICONS[method] || '❓';
}

// =============================================================================
// RISK LEVEL UTILITIES
// =============================================================================

/**
 * Get styling for risk badge based on level
 */
export function getRiskBadgeStyle(level: RiskLevel | string): React.CSSProperties {
  const styles: Record<RiskLevel, React.CSSProperties> = {
    low: { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
    medium: { background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
    high: { background: 'rgba(249, 115, 22, 0.2)', color: '#f97316' },
    critical: { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
  };
  return styles[level as RiskLevel] || {};
}

/**
 * Get risk level color
 */
export function getRiskColor(level: RiskLevel | string): string {
  const colors: Record<RiskLevel, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };
  return colors[level as RiskLevel] || '#888';
}

// Critical tool names for risk assessment
const CRITICAL_TOOLS = ['execute', 'shell', 'run_command', 'eval'];
const HIGH_RISK_TOOLS = ['write', 'delete', 'remove', 'update', 'modify'];
const MEDIUM_RISK_TOOLS = ['read', 'get', 'fetch', 'download'];

/**
 * Determine risk level for a tool based on its name
 */
export function getToolRiskLevel(toolName: string): RiskLevel {
  const lowerName = toolName.toLowerCase();

  if (CRITICAL_TOOLS.some((t) => lowerName.includes(t))) return 'critical';
  if (HIGH_RISK_TOOLS.some((t) => lowerName.includes(t))) return 'high';
  if (MEDIUM_RISK_TOOLS.some((t) => lowerName.includes(t))) return 'medium';
  return 'low';
}

// =============================================================================
// SERVER HELPERS
// =============================================================================

/**
 * Get server name by ID from a list of servers
 */
export function getServerName(servers: MCPServer[], serverId: string): string {
  const server = servers.find((s) => s.id === serverId);
  return server?.name || serverId;
}

// =============================================================================
// ACCESSIBILITY HELPERS
// =============================================================================

/**
 * Generate a unique ID for accessibility attributes
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create aria-describedby value from multiple IDs
 */
export function combineDescribedBy(...ids: (string | undefined)[]): string | undefined {
  const validIds = ids.filter(Boolean);
  return validIds.length > 0 ? validIds.join(' ') : undefined;
}

// =============================================================================
// KEYBOARD HELPERS
// =============================================================================

/**
 * Check if a keyboard event is an activation key (Enter or Space)
 */
export function isActivationKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

/**
 * Handle keyboard activation for clickable elements
 */
export function handleKeyboardActivation(
  event: React.KeyboardEvent,
  handler: () => void
): void {
  if (isActivationKey(event)) {
    event.preventDefault();
    handler();
  }
}
