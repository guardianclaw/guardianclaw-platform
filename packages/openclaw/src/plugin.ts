/**
 * @guardianclaw/openclaw - OpenClaw Plugin Entry Point
 *
 * Thin adapter wiring GuardianClaw hooks into OpenClaw's plugin lifecycle.
 *
 * Architecture (Core Hooks + Thin Adapter):
 * - Core logic lives in hooks/handlers.ts (pure functions)
 * - Factory in hooks/index.ts creates hook instances
 * - This file adapts OpenClaw's API to our hooks
 *
 * @example OpenClaw loads this plugin via:
 * ```json
 * // openclaw.config.json
 * {
 *   "plugins": {
 *     "claw": {
 *       "level": "watch"
 *     }
 *   }
 * }
 * ```
 */

import { definePluginEntry, emptyPluginConfigSchema } from 'openclaw/plugin-sdk/core';
import type { GuardianClawOpenClawConfig } from './types';
import { createGuardianClawHooks, type GuardianClawHooks } from './hooks';

// OpenClaw's full PluginApi surface is large; we type the minimum we touch.
type OpenClawPluginLike = {
  readonly pluginConfig?: Record<string, unknown>;
  readonly logger: {
    info: (message: string, data?: Record<string, unknown>) => void;
    warn: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
    debug: (message: string, data?: Record<string, unknown>) => void;
  };
  on: (
    hookName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => any,
    opts?: { priority?: number }
  ) => void;
};

function deriveMessageSessionId(ctx: { channelId?: string; conversationId?: string }): string {
  return ctx.conversationId ?? ctx.channelId ?? 'default';
}

function deriveAgentSessionId(ctx: { sessionKey?: string; agentId?: string }): string {
  return ctx.sessionKey ?? ctx.agentId ?? 'default';
}

function registerAll(api: OpenClawPluginLike, hooks: GuardianClawHooks): void {
  // before_prompt_build: cacheable seed injection. Cheaper than before_agent_start
  // because prependSystemContext is prompt-cached by providers.
  api.on(
    'before_prompt_build',
    (
      _event: { prompt: string; messages: unknown[] },
      ctx: { sessionKey?: string; agentId?: string }
    ) => {
      const sessionId = deriveAgentSessionId(ctx);
      const result = hooks.beforeAgentStart({ sessionId });
      if (!result?.additionalContext) {
        return undefined;
      }
      api.logger.debug('Injecting safety seed');
      return { prependSystemContext: result.additionalContext };
    },
    { priority: 100 }
  );

  api.on(
    'message_received',
    (event: { content: string }, ctx: { channelId?: string; conversationId?: string }) => {
      hooks.messageReceived({
        sessionId: deriveMessageSessionId(ctx),
        content: event.content,
        timestamp: Date.now(),
      });
    },
    { priority: 100 }
  );

  api.on(
    'message_sending',
    async (event: { content: string }, ctx: { channelId?: string; conversationId?: string }) => {
      const sessionId = deriveMessageSessionId(ctx);
      const result = await hooks.messageSending({ sessionId, content: event.content });
      if (!result?.cancel) {
        return undefined;
      }
      api.logger.warn('Blocking output', { reason: result.cancelReason });
      return { cancel: true, cancelReason: result.cancelReason };
    },
    { priority: 100 }
  );

  api.on(
    'before_tool_call',
    async (
      event: { toolName: string; params: Record<string, unknown> },
      ctx: { sessionKey?: string; agentId?: string }
    ) => {
      const sessionId = deriveAgentSessionId(ctx);
      const result = await hooks.beforeToolCall({
        sessionId,
        toolName: event.toolName,
        params: event.params,
      });
      if (!result?.block) {
        return undefined;
      }
      api.logger.warn('Blocking tool call', {
        toolName: event.toolName,
        reason: result.blockReason,
      });
      return { block: true, blockReason: result.blockReason };
    },
    { priority: 100 }
  );

  api.on(
    'agent_end',
    (
      event: { messages: unknown[]; success: boolean; error?: string; durationMs?: number },
      ctx: { sessionKey?: string; agentId?: string }
    ) => {
      hooks.agentEnd({
        sessionId: deriveAgentSessionId(ctx),
        success: event.success,
        error: event.error ? new Error(event.error) : undefined,
        durationMs: event.durationMs,
      });
      api.logger.debug('Session ended');
    },
    { priority: 50 }
  );
}

// eslint-disable-next-line import/no-default-export
export default definePluginEntry({
  id: 'guardianclaw',
  name: 'GuardianClaw Safety',
  description:
    'CLAW protocol validation, data leak prevention, and tool safety for OpenClaw agents.',
  configSchema: emptyPluginConfigSchema,
  register: (api) => {
    const typedApi = api as unknown as OpenClawPluginLike;
    const userConfig = (typedApi.pluginConfig ?? {}) as Partial<GuardianClawOpenClawConfig>;
    const hooks = createGuardianClawHooks(userConfig);

    typedApi.logger.info('GuardianClaw initialized', { level: userConfig.level ?? 'watch' });

    if (userConfig.level === 'off') {
      typedApi.logger.info('GuardianClaw is disabled (level: off)');
      return;
    }

    registerAll(typedApi, hooks);
  },
});

/**
 * Legacy named-export retained for callers still doing
 * `import { register } from '@guardianclaw/openclaw/plugin'`.
 * Prefer the default export for new code.
 */
export function register(api: OpenClawPluginLike): void {
  const userConfig = (api.pluginConfig ?? {}) as Partial<GuardianClawOpenClawConfig>;
  const hooks = createGuardianClawHooks(userConfig);

  api.logger.info('GuardianClaw initialized', { level: userConfig.level ?? 'watch' });

  if (userConfig.level === 'off') {
    api.logger.info('GuardianClaw is disabled (level: off)');
    return;
  }

  registerAll(api, hooks);
}
