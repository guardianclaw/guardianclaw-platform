import { Hono } from 'hono'
import { z } from 'zod'
import { createRateLimiter } from '../lib/rate-limiter'

type Bindings = {
  RESEND_API_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
}

const subjectLabels: Record<string, string> = {
  general: 'General Inquiry',
  security: 'Security',
  partnership: 'Partnership',
  support: 'Support',
  other: 'Other',
}

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.enum(['general', 'security', 'partnership', 'support', 'other']),
  message: z.string().min(10).max(5000),
})

export const contactRoutes = new Hono<{ Bindings: Bindings }>()

// POST /contact — Send a contact form email via Resend
contactRoutes.post('/', async (c) => {
  // Check for Resend API key
  if (!c.env.RESEND_API_KEY) {
    return c.json({ error: 'Contact service is not configured. Please try again later.' }, 503)
  }

  // Rate limit: 5 requests per minute per IP
  const clientIP = c.req.header('cf-connecting-ip') || 'unknown'
  const rateLimiter = createRateLimiter(c.env.RATE_LIMIT_KV || null, 'contact:')
  const { allowed, retryAfter } = await rateLimiter.checkLimit(clientIP, 5, 60_000)

  if (!allowed) {
    c.header('Retry-After', (retryAfter || 60).toString())
    return c.json({ error: 'Too many requests. Please try again later.' }, 429)
  }

  // Validate request body
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const { name, email, subject, message } = parsed.data
  const subjectLabel = subjectLabels[subject] || subject

  try {
    // Use Resend HTTP API directly (no SDK needed for Workers)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GuardianClaw Contact <notifications@guardianclaw.org>',
        to: ['contact@guardianclaw.org'],
        reply_to: email,
        subject: `[Contact] ${subjectLabel} — ${name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px;">
              New Contact Form Submission
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #555; width: 100px;">Name</td>
                <td style="padding: 8px 12px;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #555;">Email</td>
                <td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #555;">Subject</td>
                <td style="padding: 8px 12px;">${escapeHtml(subjectLabel)}</td>
              </tr>
            </table>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="font-weight: 600; color: #555; margin: 0 0 8px 0;">Message</p>
              <p style="color: #1a1a1a; white-space: pre-wrap; margin: 0;">${escapeHtml(message)}</p>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              Sent via guardianclaw.org contact form. Reply directly to respond to ${escapeHtml(name)}.
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const errorData = await res.text()
      console.error('Resend API error:', res.status, errorData)
      throw new Error(`Resend API error: ${res.status}`)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Failed to send contact email:', error)
    return c.json({ error: 'Failed to send message. Please try again later.' }, 500)
  }
})

// Basic HTML escaping to prevent XSS in email content
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
