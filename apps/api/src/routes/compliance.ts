import { Hono } from 'hono'
import { z } from 'zod'
import { createRateLimiter } from '../lib/rate-limiter'

type Bindings = {
  MODAL_COMPLIANCE_URL?: string
  OPENAI_API_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
}

export const complianceRoutes = new Hono<{ Bindings: Bindings }>()

// Validation schema for compliance check
const complianceCheckSchema = z.object({
  content: z.string().min(1).max(50000),
  document_type: z
    .enum([
      'system-prompt',
      'research-paper',
      'policy-document',
      'api-documentation',
      'general-text',
    ])
    .default('system-prompt'),
  framework: z.enum(['eu-ai-act', 'owasp-llm', 'owasp-agentic', 'csa-aicm']).default('eu-ai-act'),
  context: z.string().default('general'),
  system_type: z.enum(['high_risk', 'limited_risk', 'minimal_risk', 'gpai']).default('high_risk'),
  // Tiered validation support
  validation_mode: z.enum(['semantic', 'heuristic']).default('semantic'),
  llm_api_key: z.string().optional(), // User's own API key (BYOK)
})

// Modal.com compliance endpoint URL
const MODAL_COMPLIANCE_URL = 'https://guardian-claw--claw-runtime-check-compliance-web.modal.run'

// POST /compliance/check - Check content against compliance frameworks
// Public endpoint with rate limiting (no auth required for demo)
complianceRoutes.post('/check', async (c) => {
  // Rate limiting by IP (20 requests per minute)
  const clientIP = c.req.header('cf-connecting-ip') || 'unknown'
  const rateLimiter = createRateLimiter(c.env.RATE_LIMIT_KV || null, 'compliance:')
  const { allowed, retryAfter } = await rateLimiter.checkLimit(clientIP, 20, 60_000)

  if (!allowed) {
    c.header('Retry-After', (retryAfter || 60).toString())
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429)
  }

  // Parse and validate request
  const body = await c.req.json()
  const parsed = complianceCheckSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const { content, document_type, framework, context, system_type, validation_mode, llm_api_key } =
    parsed.data
  const startTime = Date.now()

  // Call Modal.com runtime endpoint
  const modalUrl = c.env.MODAL_COMPLIANCE_URL || MODAL_COMPLIANCE_URL

  try {
    const modalResponse = await fetch(modalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        document_type,
        framework,
        context,
        system_type,
        validation_mode,
        // Pass user's API key for BYOK, or use our key for 'limited' tier
        // Heuristic mode doesn't need LLM key
        llm_api_key: validation_mode === 'heuristic' ? undefined : llm_api_key,
      }),
    })

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text()
      console.error('Modal compliance error:', modalResponse.status, errorText)
      throw new Error(`Compliance service error: ${modalResponse.status}`)
    }

    const result = (await modalResponse.json()) as Record<string, unknown>

    return c.json({
      ...result,
      api_latency_ms: Date.now() - startTime,
      runtime: 'modal',
    })
  } catch (error) {
    console.error('Compliance check error:', error)

    // Return error response
    return c.json(
      {
        error: 'Compliance check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        framework,
        document_type,
        compliant: null,
        api_latency_ms: Date.now() - startTime,
      },
      500
    )
  }
})

// GET /compliance/frameworks - List available frameworks
complianceRoutes.get('/frameworks', async (c) => {
  return c.json({
    frameworks: [
      {
        id: 'eu-ai-act',
        name: 'EU AI Act',
        description: 'European Union AI regulation (Regulation 2024/1689)',
        version: '2024',
        available: true,
      },
      {
        id: 'owasp-llm',
        name: 'OWASP LLM Top 10',
        description: 'Security risks for LLM applications',
        version: '2025',
        available: true,
      },
      {
        id: 'owasp-agentic',
        name: 'OWASP Agentic Top 10',
        description: 'Security risks for autonomous AI agents',
        version: '2026',
        available: true,
      },
      {
        id: 'csa-aicm',
        name: 'CSA AI Controls Matrix',
        description: 'Cloud Security Alliance AI Controls Matrix',
        version: '1.0',
        available: true,
      },
    ],
    document_types: [
      {
        id: 'system-prompt',
        name: 'System Prompt',
        description: 'AI system prompts and agent instructions',
      },
      {
        id: 'research-paper',
        name: 'Research Paper',
        description: 'Academic papers, whitepapers, technical reports',
      },
      {
        id: 'policy-document',
        name: 'Policy Document',
        description: 'Terms of service, privacy policies, internal guidelines',
      },
      {
        id: 'api-documentation',
        name: 'API Documentation',
        description: 'API specs, SDK docs, integration guides',
      },
      {
        id: 'general-text',
        name: 'General Text',
        description: 'Any text content for compliance review',
      },
    ],
    contexts: [
      { id: 'general', name: 'General', high_risk: false },
      { id: 'healthcare', name: 'Healthcare', high_risk: true },
      { id: 'employment', name: 'Employment', high_risk: true },
      { id: 'education', name: 'Education', high_risk: true },
      { id: 'law_enforcement', name: 'Law Enforcement', high_risk: true },
      { id: 'financial', name: 'Financial Services', high_risk: true },
      { id: 'critical_infrastructure', name: 'Critical Infrastructure', high_risk: true },
    ],
  })
})
