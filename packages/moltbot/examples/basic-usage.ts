/**
 * Basic Usage Example
 *
 * Shows how to use @guardianclaw/moltbot with Moltbot.
 */

import { createGuardianClawHooks } from '@guardianclaw/moltbot';

// Create hooks with guard level protection
const hooks = createGuardianClawHooks({
  level: 'guard',
});

// Export for Moltbot plugin registration
export const moltbot_hooks = {
  message_received: hooks.messageReceived,
  before_agent_start: hooks.beforeAgentStart,
  message_sending: hooks.messageSending,
  before_tool_call: hooks.beforeToolCall,
  agent_end: hooks.agentEnd,
};

// That's it! GuardianClaw is now protecting your agent.
