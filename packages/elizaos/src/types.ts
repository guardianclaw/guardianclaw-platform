/**
 * GuardianClaw ElizaOS Plugin Types
 *
 * Type definitions matching ElizaOS core interfaces.
 * Based on @elizaos/core v2.x types.
 */

// ElizaOS UUID type — plain string (matches @elizaos/core@2.x)
export type UUID = string;

// Content type matching ElizaOS
export interface Content {
  text?: string;
  thought?: string;
  actions?: string[];
  providers?: string[];
  source?: string;
  url?: string;
  inReplyTo?: UUID;
  [key: string]: unknown;
}

// Memory interface matching ElizaOS core
export interface Memory {
  id?: UUID;
  entityId?: UUID;
  agentId?: UUID;
  createdAt?: number;
  content: Content;
  embedding?: number[];
  roomId?: UUID;
  worldId?: UUID;
  unique?: boolean;
  similarity?: number;
  metadata?: Record<string, unknown>;
}

// State interface
export interface State {
  [key: string]: unknown;
}

// Agent runtime interface (subset needed for plugin)
export interface IAgentRuntime {
  agentId: UUID;
  character?: {
    name?: string;
    system?: string;
    [key: string]: unknown;
  };
  getSetting(key: string): string | undefined;
  getService<T>(name: string): T | undefined;
}

// Handler options
export interface HandlerOptions {
  [key: string]: unknown;
}

// Action result type
export interface ActionResult {
  success: boolean;
  /** Optional text description of the result (was `response` in 1.x) */
  text?: string;
  data?: unknown;
  error?: string | Error;
}

// Provider result type
export interface ProviderResult {
  text?: string;
  values?: Record<string, unknown>;
  data?: unknown;
}

// Handler callback - matches ElizaOS signature
export type HandlerCallback = (
  response: Content,
  actionName?: string
) => Promise<Memory[]>;

// Action example for documentation
export interface ActionExample {
  user: string;
  content: Content;
}

// Evaluation example
export interface EvaluationExample {
  prompt: string;
  messages: Array<{ role: string; content: string }>;
  outcome: string;
}

// Handler type matching ElizaOS
export type Handler = (
  runtime: IAgentRuntime,
  message: Memory,
  state?: State,
  options?: HandlerOptions,
  callback?: HandlerCallback,
  responses?: Memory[]
) => Promise<ActionResult | void | undefined>;

// Validator type matching ElizaOS
export type Validator = (
  runtime: IAgentRuntime,
  message: Memory,
  state?: State
) => Promise<boolean>;

// Action interface matching ElizaOS
export interface Action {
  name: string;
  description: string;
  similes?: string[];
  examples?: ActionExample[][];
  validate: Validator;
  handler: Handler;
  [key: string]: unknown;
}

// Provider interface matching ElizaOS
export interface Provider {
  name: string;
  description?: string;
  dynamic?: boolean;
  position?: number;
  private?: boolean;
  get: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ) => Promise<ProviderResult>;
}

// Evaluator interface matching ElizaOS
export interface Evaluator {
  name: string;
  description: string;
  alwaysRun?: boolean;
  similes?: string[];
  examples: EvaluationExample[];
  validate: Validator;
  handler: Handler;
}

// Plugin interface matching ElizaOS
export interface Plugin {
  name: string;
  description: string;
  init?: (
    config: Record<string, string>,
    runtime: IAgentRuntime
  ) => Promise<void> | void;
  config?: Record<string, unknown>;
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  services?: unknown[];
  dependencies?: string[];
  priority?: number;
}

// GuardianClaw-specific types
export type SeedVersion = 'v1' | 'v2';
export type SeedVariant = 'minimal' | 'standard' | 'full';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type GateStatus = 'pass' | 'fail' | 'unknown';  // 'unknown' used for invalid input validation

export interface CLAWGates {
  credibility: GateStatus;
  avoidance: GateStatus;
  limits: GateStatus;
  worth: GateStatus;
}

export interface SafetyCheckResult {
  safe: boolean;
  shouldProceed: boolean;
  gates: CLAWGates;
  concerns: string[];
  riskLevel: RiskLevel;
  recommendation: string;
  timestamp: number;
}

export interface GuardianClawPluginConfig {
  seedVersion?: SeedVersion;
  seedVariant?: SeedVariant;
  blockUnsafe?: boolean;
  logChecks?: boolean;
  customPatterns?: Array<{
    name: string;
    pattern: RegExp;
    gate: keyof CLAWGates;
  }>;
  skipActions?: string[];
  // Memory integrity settings
  memoryIntegrity?: {
    enabled: boolean;
    secretKey?: string;
    verifyOnRead?: boolean;
    signOnWrite?: boolean;
    minTrustScore?: number;
  };
}

export interface ValidationContext {
  actionName?: string;
  entityId?: string;
  roomId?: string;
  metadata?: Record<string, unknown>;
}
