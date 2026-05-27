import { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  CircleDollarSign,
  Code2,
  ListChecks,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'ClawPay — Decision Firewall for AI Agent Payments | GuardianClaw',
  description:
    'Fraud prevention and spending governance for autonomous AI agents on Coinbase x402 and the Stripe Agent Toolkit. Built on the GuardianClaw 4-gate CLAW protocol with deterministic, explainable decisions.',
  openGraph: {
    title: 'ClawPay — Decision Firewall for AI Agent Payments',
    description:
      'Stop drainer addresses, enforce spending limits, and audit every CLAW decision before your agent moves a dollar — on x402 or Stripe.',
  },
}

// Real numbers from public 2026 research used in the marketing copy. Kept as
// constants so they're easy to update when sources move.
const STATS = [
  {
    value: '$600M+',
    label: 'Crypto lost to hacks in Q1 2026',
    source: 'Aggregated incident reports',
  },
  { value: '$600M', label: 'Annualized x402 volume (March 2026)', source: 'Coinbase x402' },
  {
    value: '2 providers',
    label: 'x402 + Stripe Agent Toolkit, same gates',
    source: 'GuardianClaw v3.x',
  },
  { value: '<150ms', label: 'Target p95 latency overhead', source: 'ClawPay SLA target' },
]

const PROVIDERS = [
  {
    name: 'Coinbase x402',
    summary: 'HTTP 402 stablecoin micropayments on Base and Solana.',
    install: 'pip install "guardianclaw[x402]"',
  },
  {
    name: 'Stripe Agent Toolkit',
    summary:
      'PaymentIntents, Charges, Refunds and Transfers from any OpenAI / LangChain / CrewAI / Vercel AI SDK agent.',
    install: 'npm install @guardianclaw/stripe-agent-toolkit',
  },
]

const GATES = [
  {
    icon: ShieldCheck,
    name: 'Credibility',
    blurb:
      'Validates the payment request itself: endpoint TLS, supported network, verified asset contract, well-formed amount.',
  },
  {
    icon: ListChecks,
    name: 'Avoidance',
    blurb:
      'Consults the drainer_intel feed (ScamSniffer, GoPlus, Blowfish) plus your blocklist. Hits cite a specific source — no opaque classifier scores.',
  },
  {
    icon: CircleDollarSign,
    name: 'Limits',
    blurb:
      'Enforces your USD spending caps over rolling windows (hourly, daily, monthly, lifetime). Deterministic math, no surprises.',
  },
  {
    icon: Sparkles,
    name: 'Worth',
    blurb:
      'Requires the agent to declare a purpose. Sub-dollar micro-payments pass cleanly; high-value flows must justify themselves.',
  },
]

const CODE_PY = `from guardianclaw.integrations.coinbase.x402 import (
    GuardianClawX402Middleware,
    DrainerLookup,
    SupabaseDrainerSource,
)

middleware = GuardianClawX402Middleware(
    drainer_lookup=DrainerLookup(sources=[
        SupabaseDrainerSource(
            supabase_url=os.environ["SUPABASE_URL"],
            api_key=os.environ["SUPABASE_SERVICE_KEY"],
        ),
    ]),
)

# Validate before your agent signs the transaction.
result = middleware.validate_payment(
    payment_requirements=payment_req,
    endpoint="https://api.example.com/paid",
    wallet_address=agent_wallet,
)

if not result.is_approved:
    log.warning("Payment blocked: %s", result.blocked_reason)
    return  # do not sign.`

export default function ClawPayLandingPage() {
  return (
    <main className="bg-background">
      {/* ============================================================
       *  Hero
       * ========================================================== */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="from-claw-500/10 absolute inset-0 -z-10 bg-gradient-to-b to-transparent"
        />
        <div className="container mx-auto px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="bg-claw-500/10 text-claw-600 dark:text-claw-300 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              First commercial product on top of GuardianClaw
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              The Decision Firewall for <span className="text-claw-500">AI agent payments</span>
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg sm:text-xl">
              Drainer detection, spending governance, and full audit for every x402 and Stripe Agent
              Toolkit transaction your AI agents make — with deterministic decisions you can explain
              to an auditor.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/docs/products/clawpay/getting-started">
                <Button size="lg" className="bg-claw-600 hover:bg-claw-700">
                  <Code2 className="mr-2 h-4 w-4" />
                  Read the docs
                </Button>
              </Link>
              <Link href="/app/clawpay">
                <Button size="lg" variant="outline">
                  Open dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="text-muted-foreground mt-6 text-xs">
              Built on GuardianClaw v3.x — the open-source CLAW protocol for AI agent safety.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
       *  Stats strip
       * ========================================================== */}
      <section className="border-border border-y">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((s) => (
              <li key={s.label} className="text-center">
                <p className="text-claw-500 text-3xl font-bold tabular-nums sm:text-4xl">
                  {s.value}
                </p>
                <p className="text-foreground mt-2 text-sm font-medium">{s.label}</p>
                <p className="text-muted-foreground mt-1 text-xs">{s.source}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================
       *  Two payment surfaces, one protocol
       * ========================================================== */}
      <section className="container mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            One protocol, two payment surfaces
          </h2>
          <p className="text-muted-foreground text-lg">
            Whether your agent transacts on-chain via Coinbase x402 or off-chain via the Stripe
            Agent Toolkit, the same four CLAW gates produce the same audit row. Switch providers
            without re-tuning your thresholds.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          {PROVIDERS.map((p) => (
            <Card key={p.name}>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{p.summary}</p>
                <pre className="bg-muted mt-4 overflow-x-auto rounded px-3 py-2 font-mono text-xs">
                  <code>{p.install}</code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================================================
       *  Problem
       * ========================================================== */}
      <section className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            AI agents make payments. Then they get drained.
          </h2>
          <p className="text-muted-foreground text-lg">
            x402 and Stripe Agent Toolkit unlocked autonomous machine-to-machine payments at massive
            scale. The same primitives let attackers route an agent into a drainer contract before
            the human ever sees a transaction.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <Zap className="mb-3 h-8 w-8 text-red-500" aria-hidden />
              <h3 className="font-semibold">Drainer kits target agents</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Bit-flip and simulation-spoofing drainers (aqua, vanish) bypass wallet-level checks.
                ClawPay consults a deterministic intel feed before the agent signs.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <CircleDollarSign className="mb-3 h-8 w-8 text-amber-500" aria-hidden />
              <h3 className="font-semibold">No spending guardrails</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                A bug in your agent loop can spend a whole budget in seconds. ClawPay enforces USD
                caps over the windows you choose — hourly, daily, lifetime.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Network className="text-claw-500 mb-3 h-8 w-8" aria-hidden />
              <h3 className="font-semibold">Auditing is impossible</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Classifier-based safety can&apos;t explain a block. ClawPay records every gate
                outcome and every drainer-intel hit with citation, ready for compliance review.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================
       *  The four CLAW gates applied to payments
       * ========================================================== */}
      <section className="bg-muted/30">
        <div className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Four gates per payment</h2>
            <p className="text-muted-foreground text-lg">
              The CLAW protocol from GuardianClaw v3.x, specialized for payment semantics. Every
              gate is deterministic where it matters — limits are math, drainer lookups are exact
              matches against an intel feed with source citation.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
            {GATES.map((gate) => (
              <Card key={gate.name}>
                <CardContent className="pt-6">
                  <div className="bg-claw-500/10 text-claw-600 dark:text-claw-300 mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg">
                    <gate.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold">{gate.name}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{gate.blurb}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
       *  Defeating simulation-spoofing drainers (Sprint 4)
       * ========================================================== */}
      <section className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="bg-claw-500/10 text-claw-600 dark:text-claw-300 mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            New · Sprint 4
          </div>
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Defeating simulation-spoofing drainers
          </h2>
          <p className="text-muted-foreground text-lg">
            <strong>aqua</strong>, <strong>vanish</strong>, and TOCTOU drainer kits trick wallet
            simulation by mutating the transaction between sign and broadcast. ClawPay re-runs the
            simulation against Helius (Solana) or Tenderly (EVM) right before broadcast and blocks
            when the simulated outflow exceeds the advertised payment, when account ownership is
            reassigned, or when the transaction would revert on-chain.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-foreground font-semibold">Balance discrepancy</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Bit-flip drainers swap the recipient or the amount after sign. Simulation reveals
                the real outflow — the AvoidanceGate cites the delta in the block reason.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-foreground font-semibold">Ownership reassignment</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Solana <code className="font-mono text-xs">Assign</code> instructions that flip a
                wallet's owner to an attacker program are detected from the post-execution accounts
                blob and from log signatures.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-foreground font-semibold">Would-fail rejection</p>
              <p className="text-muted-foreground mt-1 text-sm">
                When the simulator returns an <code className="font-mono text-xs">err</code>,
                ClawPay flags it as a Credibility issue so the agent can rebuild the request instead
                of broadcasting a doomed transaction.
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-xs">
          Fail-safe by design: RPC timeouts, malformed payloads, or unsupported chains never block a
          payment on their own — they surface as risk factors and let the other CLAW gates decide.
        </p>
      </section>

      {/* ============================================================
       *  Code snippet
       * ========================================================== */}
      <section className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">Drop-in integration</h2>
            <p className="text-muted-foreground text-lg">
              Wraps the Coinbase x402 SDK as middleware. Bring your existing AgentKit or httpx setup
              — ClawPay is a few lines of Python.
            </p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <pre
                className={cn(
                  'bg-muted overflow-x-auto px-6 py-6 text-xs leading-relaxed',
                  'font-mono'
                )}
              >
                <code>{CODE_PY}</code>
              </pre>
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/docs/products/clawpay/getting-started">
              <Button variant="outline">
                <Workflow className="mr-2 h-4 w-4" />
                Full integration guide
              </Button>
            </Link>
            <Link href="https://pypi.org/project/guardianclaw/" target="_blank" rel="noopener">
              <Button variant="ghost">pip install guardianclaw</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
       *  Pricing teaser
       * ========================================================== */}
      <section className="bg-muted/30">
        <div className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Pricing aligned with outcomes</h2>
            <p className="text-muted-foreground text-lg">
              Free tier for early integration, then we charge a small percentage of the value we
              block. No money saved, no fee — your incentives and ours align.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-foreground text-sm font-semibold">Free</p>
                <p className="mt-2 text-3xl font-bold">$0</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Up to 1,000 validations / month
                </p>
                <ul className="text-muted-foreground mt-4 space-y-1.5 text-sm">
                  <li>• Full CLAW protocol</li>
                  <li>• 7-day audit retention</li>
                  <li>• Community support</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-claw-500/40 ring-claw-500/20 ring-2">
              <CardContent className="pt-6">
                <p className="text-claw-600 dark:text-claw-300 text-sm font-semibold">
                  Pro (most teams)
                </p>
                <p className="mt-2 text-3xl font-bold">
                  $99<span className="text-muted-foreground text-sm font-normal">/agent/mo</span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">+ 0.5% on blocked value</p>
                <ul className="text-muted-foreground mt-4 space-y-1.5 text-sm">
                  <li>• Unlimited validations</li>
                  <li>• 90-day audit retention</li>
                  <li>• &lt; 150ms p95 SLA</li>
                  <li>• Webhook alerts</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-foreground text-sm font-semibold">Enterprise</p>
                <p className="mt-2 text-3xl font-bold">Custom</p>
                <p className="text-muted-foreground mt-1 text-sm">BYOK + on-prem runtime</p>
                <ul className="text-muted-foreground mt-4 space-y-1.5 text-sm">
                  <li>• Custom gates / drainer feeds</li>
                  <li>• Multi-year retention</li>
                  <li>• Dedicated support</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <p className="text-muted-foreground mt-8 text-center text-xs">
            Pricing is indicative for the beta. Final tiers will be announced at GA.
          </p>
          <div className="bg-muted/30 mx-auto mt-8 max-w-3xl rounded-lg border p-5 text-sm">
            <p className="text-foreground font-medium">Worked example</p>
            <p className="text-muted-foreground mt-1">
              An agent that processes <strong>1,000 payments</strong> in May, blocks
              <strong> $12,000</strong> of suspicious outflow on the Pro tier, pays:
            </p>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
              <li>$99 subscription</li>
              <li>
                $12,000 × 0.5% = <strong>$60 outcome fee</strong>
              </li>
              <li>
                Total: <strong>$159</strong>, against $12,000 you didn't lose
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================================
       *  Final CTA
       * ========================================================== */}
      <section className="container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="bg-muted/40 mx-auto max-w-3xl rounded-2xl border p-10 text-center">
          <h2 className="text-3xl font-bold">Try ClawPay on your next agent</h2>
          <p className="text-muted-foreground mt-3">
            Install the SDK, point it at your x402 client, and watch the audit log fill in real
            time.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/docs/products/clawpay/getting-started">
              <Button size="lg" className="bg-claw-600 hover:bg-claw-700">
                Start the integration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/clawpay">
              <Button size="lg" variant="outline">
                Open dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
