/**
 * Basic Usage Example
 *
 * Shows how to use @guardianclaw/openclaw with OpenClaw.
 */

import { createGuardianClawHooks } from '@guardianclaw/openclaw';

// Create hooks with guard level protection
const hooks = createGuardianClawHooks({
  level: 'guard',
});

// Export for OpenClaw plugin registration
export const openclaw_hooks = {
  message_received: hooks.messageReceived,
  before_agent_start: hooks.beforeAgentStart,
  message_sending: hooks.messageSending,
  before_tool_call: hooks.beforeToolCall,
  agent_end: hooks.agentEnd,
};

// That's it! GuardianClaw is now protecting your agent.
