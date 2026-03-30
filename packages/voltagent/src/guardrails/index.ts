/**
 * @guardianclaw/voltagent - Guardrails
 *
 * VoltAgent-compatible guardrails for AI safety.
 * Export all guardrail factories and types.
 */

// Input Guardrails
export {
  createGuardianClawInputGuardrail,
  createStrictInputGuardrail,
  createPermissiveInputGuardrail,
  createCLAWOnlyGuardrail,
  createOWASPOnlyGuardrail,
  type GuardianClawInputGuardrail,
} from './input';

// Output Guardrails
export {
  createGuardianClawOutputGuardrail,
  createPIIOutputGuardrail,
  createStrictOutputGuardrail,
  createPermissiveOutputGuardrail,
  type GuardianClawOutputGuardrail,
} from './output';

// Streaming Handlers
export {
  createGuardianClawPIIRedactor,
  createStrictStreamingRedactor,
  createPermissiveStreamingRedactor,
  createMonitoringStreamHandler,
  createStreamingState,
  type StreamingConfig,
} from './streaming';

// Bundle Functions
export {
  createGuardianClawGuardrails,
  createChatGuardrails,
  createAgentGuardrails,
  createPrivacyGuardrails,
  createDevelopmentGuardrails,
  getPresetConfig,
  getAvailableLevels,
  type GuardianClawGuardrailBundle,
} from './bundle';
