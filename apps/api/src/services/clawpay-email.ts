/**
 * ClawPay transactional email service (Sprint 6).
 *
 * The provider is pluggable behind `EmailProvider` so:
 *   - Production wires `ResendEmailProvider` (4k/month free, fetch-based,
 *     Workers-friendly — current default).
 *   - Tests wire `InMemoryEmailProvider` and assert against the captured
 *     outbox.
 *   - Future migrations to a different vendor are a constructor change.
 *
 * The service writes every send attempt into `clawpay_email_deliveries`
 * (append-only). Bodies are not persisted — too unbounded, too sensitive —
 * only template name, status, provider message id, and a short error
 * excerpt on failure.
 *
 * Channels marked `transactional_critical=true` in the template registry
 * ignore the tenant's `unsubscribed_at` flag (account-security messages
 * must always go out). Other channels respect both `unsubscribed_at` and
 * the per-channel boolean in `preferences`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface EmailMessage {
  to: string
  from?: string
  subject: string
  html: string
  text: string
  /** Idempotency hint passed through to providers that support it. */
  idempotencyKey?: string
  /** Tagged for analytics / webhook routing. */
  tags?: Record<string, string>
}

export interface EmailSendResult {
  status: 'sent' | 'failed' | 'rejected'
  providerMessageId?: string
  error?: string
}

export abstract class EmailProvider {
  abstract readonly name: string
  abstract send(message: EmailMessage): Promise<EmailSendResult>
}

// ============================================================================
// InMemoryEmailProvider — tests, dev, dry runs.
// ============================================================================

export class InMemoryEmailProvider extends EmailProvider {
  readonly name = 'in_memory'
  public outbox: EmailMessage[] = []
  /** When set, the provider returns this result instead of `sent`. Useful
   *  for asserting failure paths without throwing. */
  public override_: EmailSendResult | null = null

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.outbox.push(message)
    if (this.override_) return this.override_
    return {
      status: 'sent',
      providerMessageId: `inmem-${this.outbox.length}-${Date.now()}`,
    }
  }
}

// ============================================================================
// ResendEmailProvider
// ============================================================================

const RESEND_API_BASE = 'https://api.resend.com'

export interface ResendEmailProviderConfig {
  apiKey: string
  defaultFrom: string
  baseUrl?: string
  timeoutMs?: number
}

export class ResendEmailProvider extends EmailProvider {
  readonly name = 'resend'

  constructor(private readonly config: ResendEmailProviderConfig) {
    super()
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const url = `${this.config.baseUrl ?? RESEND_API_BASE}/emails`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000)

    const body = {
      from: message.from ?? this.config.defaultFrom,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.tags
        ? {
            tags: Object.entries(message.tags).map(([name, value]) => ({ name, value })),
          }
        : {}),
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          status: res.status >= 400 && res.status < 500 ? 'rejected' : 'failed',
          error: `Resend ${res.status}: ${text.slice(0, 512)}`,
        }
      }

      const payload = (await res.json().catch(() => ({}))) as { id?: string }
      return {
        status: 'sent',
        providerMessageId: payload.id,
      }
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      clearTimeout(timer)
    }
  }
}

// ============================================================================
// Templates
// ============================================================================

export type EmailTemplate =
  | 'welcome'
  | 'beta_invite_redeemed'
  | 'period_closed'
  | 'alerts_summary_daily'
  | 'alerts_critical'

interface TemplateMeta {
  /** Preferences key that controls whether the channel sends at all. */
  preferenceKey:
    | 'welcome'
    | 'period_close'
    | 'alerts_summary_daily'
    | 'alerts_critical'
    | 'product_updates'
  /** When true, send even if the user has unsubscribed (account / security). */
  transactional_critical: boolean
}

const TEMPLATE_REGISTRY: Record<EmailTemplate, TemplateMeta> = {
  welcome: { preferenceKey: 'welcome', transactional_critical: true },
  beta_invite_redeemed: {
    preferenceKey: 'welcome',
    transactional_critical: true,
  },
  period_closed: {
    preferenceKey: 'period_close',
    transactional_critical: true,
  },
  alerts_summary_daily: {
    preferenceKey: 'alerts_summary_daily',
    transactional_critical: false,
  },
  alerts_critical: {
    preferenceKey: 'alerts_critical',
    transactional_critical: true,
  },
}

export function isTemplateTransactionalCritical(template: EmailTemplate): boolean {
  return TEMPLATE_REGISTRY[template].transactional_critical
}

export function getTemplatePreferenceKey(template: EmailTemplate): TemplateMeta['preferenceKey'] {
  return TEMPLATE_REGISTRY[template].preferenceKey
}

// --- Template renderers — keep the HTML deliberately small so the worker
//     image stays compact. We do NOT pull a templating engine; plain
//     template literals are sufficient at this scale.

export interface WelcomeContext {
  walletAddress: string
  dashboardUrl: string
}

export interface BetaInviteRedeemedContext {
  walletAddress: string
  code: string
  dashboardUrl: string
}

export interface PeriodClosedContext {
  walletAddress: string
  periodStart: string
  periodEnd: string
  blockedValueUsd: number
  blockedEventCount: number
  usageFeeUsd: number
  subscriptionFeeUsd: number
  totalUsd: number
  dashboardUrl: string
}

export interface AlertsCriticalContext {
  walletAddress: string
  alertName: string
  triggeredAt: string
  reason: string
  dashboardUrl: string
}

type TemplateContextMap = {
  welcome: WelcomeContext
  beta_invite_redeemed: BetaInviteRedeemedContext
  period_closed: PeriodClosedContext
  alerts_summary_daily: { walletAddress: string; periodLabel: string; dashboardUrl: string }
  alerts_critical: AlertsCriticalContext
}

export interface RenderedTemplate {
  subject: string
  html: string
  text: string
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const FOOTER_HTML = `
  <hr style="border:0;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#888;font-size:12px">
    GuardianClaw · ClawPay — Decision Firewall for AI Agent Payments<br />
    <a href="https://guardianclaw.org" style="color:#888">guardianclaw.org</a> ·
    <a href="https://guardianclaw.org/clawpay" style="color:#888">clawpay</a>
  </p>
`.trim()

function shell({ heading, body }: { heading: string; body: string }): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:560px;margin:24px auto;padding:0 16px;line-height:1.5">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px">${escape(heading)}</h1>
  ${body}
  ${FOOTER_HTML}
</body></html>`
}

export function renderTemplate<T extends EmailTemplate>(
  template: T,
  context: TemplateContextMap[T]
): RenderedTemplate {
  switch (template) {
    case 'welcome': {
      const c = context as WelcomeContext
      const subject = 'Welcome to GuardianClaw ClawPay'
      const html = shell({
        heading: 'Welcome to ClawPay',
        body: `
          <p>Hi ${escape(c.walletAddress.slice(0, 10))}…,</p>
          <p>Your ClawPay workspace is live. The Decision Firewall is now watching
             every payment your AI agents validate through the SDK.</p>
          <p>Three things to try next:</p>
          <ol>
            <li>Set a daily spending limit so a runaway agent can't drain a budget.</li>
            <li>Configure a webhook alert that fires the first time a payment gets blocked.</li>
            <li>Run an integration test against the sandbox before flipping production live.</li>
          </ol>
          <p><a href="${escape(c.dashboardUrl)}" style="background:#9e1d27;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Open the dashboard</a></p>
        `,
      })
      const text =
        `Welcome to GuardianClaw ClawPay\n\n` +
        `Your ClawPay workspace is live. The Decision Firewall is now watching every\n` +
        `payment your AI agents validate through the SDK.\n\n` +
        `Try:\n` +
        ` 1. Set a daily spending limit.\n` +
        ` 2. Configure a webhook alert.\n` +
        ` 3. Run an integration test against the sandbox.\n\n` +
        `Open the dashboard: ${c.dashboardUrl}\n`
      return { subject, html, text }
    }
    case 'beta_invite_redeemed': {
      const c = context as BetaInviteRedeemedContext
      const subject = "You're in: ClawPay beta access activated"
      const html = shell({
        heading: 'ClawPay beta access activated',
        body: `
          <p>Code <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px">${escape(c.code)}</code>
             was successfully redeemed by wallet ${escape(c.walletAddress.slice(0, 10))}….</p>
          <p>You now have full ClawPay access. Set up your first agent and the
             dashboard will start filling with audit events as soon as a payment
             validation lands.</p>
          <p><a href="${escape(c.dashboardUrl)}" style="background:#9e1d27;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Get started</a></p>
        `,
      })
      const text =
        `ClawPay beta access activated\n\n` +
        `Code ${c.code} redeemed by wallet ${c.walletAddress}.\n` +
        `Set up your first agent at ${c.dashboardUrl}\n`
      return { subject, html, text }
    }
    case 'period_closed': {
      const c = context as PeriodClosedContext
      const subject = `ClawPay billing period closed — ${formatUsd(c.totalUsd)}`
      const html = shell({
        heading: 'Your billing period is closed',
        body: `
          <p>Hi ${escape(c.walletAddress.slice(0, 10))}…,</p>
          <p>The ClawPay billing period covering
             <strong>${escape(c.periodStart.slice(0, 10))}</strong> →
             <strong>${escape(c.periodEnd.slice(0, 10))}</strong> is closed.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr><td>Blocked value</td><td align="right"><strong>${formatUsd(c.blockedValueUsd)}</strong> over ${c.blockedEventCount} payments</td></tr>
            <tr><td>Outcome fee</td><td align="right">${formatUsd(c.usageFeeUsd)}</td></tr>
            <tr><td>Subscription</td><td align="right">${formatUsd(c.subscriptionFeeUsd)}</td></tr>
            <tr style="border-top:1px solid #ddd"><td><strong>Total</strong></td><td align="right"><strong>${formatUsd(c.totalUsd)}</strong></td></tr>
          </table>
          <p><a href="${escape(c.dashboardUrl)}" style="background:#9e1d27;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">See the breakdown</a></p>
          <p style="color:#666;font-size:13px">We only charge an outcome fee when ClawPay actually blocks a payment.
             If we didn't save you money, that line is $0.</p>
        `,
      })
      const text =
        `ClawPay billing period closed\n\n` +
        `Period: ${c.periodStart.slice(0, 10)} -> ${c.periodEnd.slice(0, 10)}\n` +
        `Blocked value : ${formatUsd(c.blockedValueUsd)} over ${c.blockedEventCount} payments\n` +
        `Outcome fee   : ${formatUsd(c.usageFeeUsd)}\n` +
        `Subscription  : ${formatUsd(c.subscriptionFeeUsd)}\n` +
        `Total         : ${formatUsd(c.totalUsd)}\n\n` +
        `Dashboard: ${c.dashboardUrl}\n`
      return { subject, html, text }
    }
    case 'alerts_summary_daily': {
      const c = context as TemplateContextMap['alerts_summary_daily']
      const subject = `ClawPay alerts digest — ${c.periodLabel}`
      const html = shell({
        heading: `Alerts digest — ${escape(c.periodLabel)}`,
        body: `
          <p>Your ClawPay alerts digest is ready in the dashboard.</p>
          <p><a href="${escape(c.dashboardUrl)}">View deliveries and trigger history</a></p>
        `,
      })
      const text =
        `ClawPay alerts digest — ${c.periodLabel}\n\n` +
        `See deliveries and trigger history: ${c.dashboardUrl}\n`
      return { subject, html, text }
    }
    case 'alerts_critical': {
      const c = context as AlertsCriticalContext
      const subject = `[ClawPay] CRITICAL — ${c.alertName} fired`
      const html = shell({
        heading: `Critical alert: ${escape(c.alertName)}`,
        body: `
          <p>The alert <strong>${escape(c.alertName)}</strong> fired at
             <strong>${escape(c.triggeredAt)}</strong>.</p>
          <p>Reason: ${escape(c.reason)}</p>
          <p><a href="${escape(c.dashboardUrl)}" style="background:#dc2626;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Open the dashboard</a></p>
        `,
      })
      const text =
        `[CRITICAL] ${c.alertName}\n\n` +
        `Fired at: ${c.triggeredAt}\n` +
        `Reason  : ${c.reason}\n\n` +
        `Dashboard: ${c.dashboardUrl}\n`
      return { subject, html, text }
    }
    default: {
      const exhaustive: never = template
      throw new Error(`unknown template: ${exhaustive as string}`)
    }
  }
}

// ============================================================================
// Send orchestrator
// ============================================================================

export interface EmailSubscription {
  wallet_address: string
  email: string | null
  preferences: Record<string, boolean>
  unsubscribed_at: string | null
}

export interface SendOptions<T extends EmailTemplate> {
  template: T
  context: TemplateContextMap[T]
  /** Receiver. When omitted, looked up from clawpay_email_subscriptions
   *  using `walletAddress`. */
  to?: string
  walletAddress?: string
  /** Stable key for idempotency. We pass it through to the provider AND
   *  store it on the deliveries row so a webhook retry can pair back. */
  idempotencyKey?: string
}

export interface SendOutcome {
  delivered: boolean
  reason?: 'skipped_unsubscribed' | 'skipped_preference' | 'no_email_on_file' | 'sent' | 'failed'
  providerMessageId?: string
  error?: string
}

export class EmailSendError extends Error {
  constructor(
    public readonly kind: 'no_provider' | 'load_subscription_failed',
    message: string
  ) {
    super(message)
    this.name = 'EmailSendError'
  }
}

export interface EmailServiceContext {
  provider: EmailProvider
  supabase: SupabaseClient
  dashboardBaseUrl: string
}

/**
 * Resolves the recipient for a wallet, sends through the provider, and
 * persists an audit row in `clawpay_email_deliveries`. The path is:
 *
 *   1. Resolve `to` — either the explicit override or the wallet's
 *      subscription row's email. Skip + log if neither yields a value.
 *   2. Honor unsubscribed_at + the per-template preference, UNLESS the
 *      template is `transactional_critical` (account-security messages
 *      always go out).
 *   3. Render the template, call `provider.send`, persist the outcome.
 */
export async function sendClawpayEmail<T extends EmailTemplate>(
  ctx: EmailServiceContext,
  opts: SendOptions<T>
): Promise<SendOutcome> {
  let toEmail = opts.to ?? null
  let subscription: EmailSubscription | null = null

  if (opts.walletAddress) {
    const { data, error } = await ctx.supabase
      .from('clawpay_email_subscriptions')
      .select('wallet_address, email, preferences, unsubscribed_at')
      .eq('wallet_address', opts.walletAddress)
      .maybeSingle()

    if (error) {
      throw new EmailSendError('load_subscription_failed', error.message)
    }
    subscription = (data as EmailSubscription | null) ?? null
    if (!toEmail) toEmail = subscription?.email ?? null
  }

  if (!toEmail) {
    await persistDelivery(ctx, {
      walletAddress: opts.walletAddress ?? null,
      toEmail: '',
      template: opts.template,
      provider: ctx.provider.name,
      status: 'rejected',
      error: 'no email on file',
      idempotencyKey: opts.idempotencyKey ?? null,
    })
    return { delivered: false, reason: 'no_email_on_file' }
  }

  const transactionalCritical = isTemplateTransactionalCritical(opts.template)
  if (subscription && !transactionalCritical) {
    if (subscription.unsubscribed_at) {
      await persistDelivery(ctx, {
        walletAddress: opts.walletAddress ?? null,
        toEmail,
        template: opts.template,
        provider: ctx.provider.name,
        status: 'rejected',
        error: 'unsubscribed',
        idempotencyKey: opts.idempotencyKey ?? null,
      })
      return { delivered: false, reason: 'skipped_unsubscribed' }
    }
    const prefKey = getTemplatePreferenceKey(opts.template)
    if (subscription.preferences && subscription.preferences[prefKey] === false) {
      await persistDelivery(ctx, {
        walletAddress: opts.walletAddress ?? null,
        toEmail,
        template: opts.template,
        provider: ctx.provider.name,
        status: 'rejected',
        error: `preference ${prefKey}=false`,
        idempotencyKey: opts.idempotencyKey ?? null,
      })
      return { delivered: false, reason: 'skipped_preference' }
    }
  }

  // Inject the dashboard URL into every template's context so renderers
  // don't have to thread it themselves.
  const enrichedContext = {
    ...(opts.context as Record<string, unknown>),
    dashboardUrl: (opts.context as { dashboardUrl?: string }).dashboardUrl ?? ctx.dashboardBaseUrl,
  } as TemplateContextMap[T]

  const rendered = renderTemplate(opts.template, enrichedContext)

  const message: EmailMessage = {
    to: toEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: opts.idempotencyKey,
    tags: {
      template: opts.template,
      ...(opts.walletAddress ? { wallet_prefix: opts.walletAddress.slice(0, 10) } : {}),
    },
  }

  const result = await ctx.provider.send(message)

  await persistDelivery(ctx, {
    walletAddress: opts.walletAddress ?? null,
    toEmail,
    template: opts.template,
    provider: ctx.provider.name,
    status: result.status,
    providerMessageId: result.providerMessageId,
    error: result.error,
    idempotencyKey: opts.idempotencyKey ?? null,
  })

  if (result.status === 'sent') {
    return {
      delivered: true,
      reason: 'sent',
      providerMessageId: result.providerMessageId,
    }
  }
  return { delivered: false, reason: 'failed', error: result.error }
}

interface PersistArgs {
  walletAddress: string | null
  toEmail: string
  template: string
  provider: string
  status: 'pending' | 'sent' | 'failed' | 'rejected'
  providerMessageId?: string
  error?: string
  idempotencyKey: string | null
}

async function persistDelivery(ctx: EmailServiceContext, args: PersistArgs): Promise<void> {
  const { error } = await ctx.supabase.from('clawpay_email_deliveries').insert({
    wallet_address: args.walletAddress,
    to_email: args.toEmail,
    template: args.template,
    provider: args.provider,
    status: args.status,
    provider_message_id: args.providerMessageId ?? null,
    error_excerpt: args.error ? args.error.slice(0, 512) : null,
    idempotency_key: args.idempotencyKey,
    sent_at: args.status === 'sent' ? new Date().toISOString() : null,
  })
  if (error) {
    // Best-effort: failure to persist must not break the user-visible flow.
    console.error('failed to persist email delivery:', error)
  }
}
