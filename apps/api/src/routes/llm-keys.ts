import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const llmKeysRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes, then wallet-based rate limiting (100/min per wallet)
llmKeysRoutes.use('*', authMiddleware)
llmKeysRoutes.use('*', walletRateLimitMiddleware())

// Validation schemas
const createKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'groq']),
  name: z.string().min(1).max(100).default('Default'),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
  key_preview: z.string().min(1).max(20),
})

// GET /llm-keys - List all keys for the authenticated user
llmKeysRoutes.get('/', async (c) => {
  const wallet = c.get('wallet')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: keys, error } = await supabase
    .from('llm_keys')
    .select('id, provider, name, key_preview, created_at')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch LLM keys:', error)
    return c.json({ error: 'Failed to fetch keys' }, 500)
  }

  return c.json({ keys: keys || [] })
})

// GET /llm-keys/:id - Get a single key (for decryption)
llmKeysRoutes.get('/:id', async (c) => {
  const wallet = c.get('wallet')
  const keyId = c.req.param('id')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: key, error } = await supabase
    .from('llm_keys')
    .select('id, provider, name, ciphertext, iv, salt, key_preview, created_at')
    .eq('id', keyId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !key) {
    return c.json({ error: 'Key not found' }, 404)
  }

  return c.json({ key })
})

// POST /llm-keys - Store a new encrypted key
llmKeysRoutes.post('/', async (c) => {
  const wallet = c.get('wallet')
  const plan = c.get('plan')

  const body = await c.req.json()
  const parsed = createKeySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const { provider, name, ciphertext, iv, salt, key_preview } = parsed.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Check key limits per plan
  const keyLimits: Record<string, number> = {
    free: 2,
    starter: 5,
    pro: 20,
  }
  const limit = keyLimits[plan] || 2

  const { count } = await supabase
    .from('llm_keys')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)

  if ((count || 0) >= limit) {
    return c.json(
      {
        error: `Key limit reached (${count}/${limit}). Upgrade your plan to store more keys.`,
      },
      403
    )
  }

  // Check for duplicate (same provider + name)
  const { data: existing } = await supabase
    .from('llm_keys')
    .select('id')
    .eq('wallet_address', wallet)
    .eq('provider', provider)
    .eq('name', name)
    .single()

  if (existing) {
    return c.json(
      {
        error: `You already have a ${provider} key named "${name}". Delete it first or use a different name.`,
      },
      409
    )
  }

  // Insert the encrypted key
  const { data: key, error } = await supabase
    .from('llm_keys')
    .insert({
      wallet_address: wallet,
      provider,
      name,
      ciphertext,
      iv,
      salt,
      key_preview,
    })
    .select('id, provider, name, key_preview, created_at')
    .single()

  if (error) {
    console.error('Failed to store key:', error)
    return c.json({ error: 'Failed to store key' }, 500)
  }

  return c.json({ key }, 201)
})

// DELETE /llm-keys/:id - Delete a key
llmKeysRoutes.delete('/:id', async (c) => {
  const wallet = c.get('wallet')
  const keyId = c.req.param('id')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership and delete
  const { data: deleted, error } = await supabase
    .from('llm_keys')
    .delete()
    .eq('id', keyId)
    .eq('wallet_address', wallet)
    .select('id')
    .single()

  if (error || !deleted) {
    return c.json({ error: 'Key not found or already deleted' }, 404)
  }

  return c.json({ success: true, deleted_id: keyId })
})

// GET /llm-keys/provider/:provider - Get keys for a specific provider
llmKeysRoutes.get('/provider/:provider', async (c) => {
  const wallet = c.get('wallet')
  const provider = c.req.param('provider')

  const validProviders = ['openai', 'anthropic', 'openrouter', 'groq']
  if (!validProviders.includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: keys, error } = await supabase
    .from('llm_keys')
    .select('id, provider, name, key_preview, created_at')
    .eq('wallet_address', wallet)
    .eq('provider', provider)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch keys:', error)
    return c.json({ error: 'Failed to fetch keys' }, 500)
  }

  return c.json({ keys: keys || [] })
})

// Validation schema for update
const updateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

// PATCH /llm-keys/:id - Update a key's name
llmKeysRoutes.patch('/:id', async (c) => {
  const wallet = c.get('wallet')
  const keyId = c.req.param('id')

  const body = await c.req.json()
  const parsed = updateKeySchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('llm_keys')
    .select('id, provider, name')
    .eq('id', keyId)
    .eq('wallet_address', wallet)
    .single()

  if (fetchError || !existing) {
    return c.json({ error: 'Key not found' }, 404)
  }

  // Check for duplicate name if updating name
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const { data: duplicate } = await supabase
      .from('llm_keys')
      .select('id')
      .eq('wallet_address', wallet)
      .eq('provider', existing.provider)
      .eq('name', parsed.data.name)
      .neq('id', keyId)
      .single()

    if (duplicate) {
      return c.json(
        {
          error: `You already have a ${existing.provider} key named "${parsed.data.name}".`,
        },
        409
      )
    }
  }

  // Update
  const { data: updated, error: updateError } = await supabase
    .from('llm_keys')
    .update({
      name: parsed.data.name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', keyId)
    .eq('wallet_address', wallet)
    .select('id, provider, name, key_preview, created_at, updated_at')
    .single()

  if (updateError) {
    console.error('Failed to update key:', updateError)
    return c.json({ error: 'Failed to update key' }, 500)
  }

  return c.json({ success: true, key: updated })
})
