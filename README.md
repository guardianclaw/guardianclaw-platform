# GuardianClaw Platform

> The Decision Firewall for AI Agents — Build, Deploy, and Protect

## Overview

GuardianClaw Platform is a monorepo containing the web platform, API, and browser extension for the GuardianClaw safety framework. Features a visual N8N-style agent builder with CLAW (Credibility, Limits, Avoidance, Worth) protection gates.

### Tech Stack

- **Next.js 15** — App Router, Server Components
- **React Flow (@xyflow/react)** — Visual node-based flow editor
- **Zustand** — State management for flow builder
- **Vercel** — Frontend hosting with CI/CD
- **Cloudflare Workers** — Edge API with Hono.js
- **Supabase** — PostgreSQL database with RLS
- **Solana Wallet Adapter** — Sign-In With Solana (SIWS)
- **Tailwind CSS + shadcn/ui** — UI components
- **Turborepo + npm workspaces** — Monorepo orchestration
- **Modal.com** — Serverless Python runtime for agent execution
- **Python 3.10+** — SDK (`guardianclaw` on PyPI) and runtime

## Current Status

**Live URLs:**
- Frontend: https://guardianclaw.org
- API: https://claw-api-production.guardianclaw.workers.dev/health

**CI/CD:** GitHub Actions, 10 gating jobs:
Lint · TypeCheck · Test API · Test Web · Build · Pattern Sync · Corpus Validation · SDK Tests (2964 pytest) · gitleaks · npm audit.
Deploy splits into API (Cloudflare Workers via `wrangler-action`) and Web (Vercel prebuilt).

### Implemented Features

#### Landing Page & Marketing
- [x] Hero section with animated gradients
- [x] Feature showcase (CLAW gates explanation)
- [x] Testimonials and social proof
- [x] Pricing tiers (Free, Pro, Enterprise)
- [x] Integration partners section
- [x] Documentation pages (`/docs`)
- [x] Products pages (`/products`)
- [x] Use cases pages (`/use-cases`)
- [x] **Dark Mode Support** (Light/Dark/System themes)

#### Authentication
- [x] Solana wallet connection (Phantom, Solflare, etc.)
- [x] SIWS (Sign-In With Solana) authentication flow
- [x] Protected routes with auth context
- [x] Demo mode for unauthenticated users

#### Builder (N8N Style)
- [x] Visual canvas with React Flow
- [x] Node palette with drag-and-drop
- [x] Custom node types:
  - **Input nodes:** User Message, API Input, Webhook
  - **Process nodes:** LLM Call, Transform, Condition
  - **GuardianClaw nodes:** All Gates, Credibility, Limits, Avoidance, Worth
  - **Tool nodes:** Web Search, Code Exec, API Request, Database
  - **Output nodes:** Response, Webhook Out, Store
  - **Flow nodes:** Router, Merge, Loop
  - **Memory nodes:** Buffer, Vector, Summary
  - **Utility nodes:** Delay, Log
- [x] Node connections with animated edges
- [x] Properties panel for node configuration
- [x] Minimap and zoom controls
- [x] Grid snap functionality
- [x] Demo agent with pre-configured flow
- [x] Visual redesign of nodes (N8N-like)
- [x] Flow execution engine integrated with Test Sandbox

#### Builder Sub-pages
- [x] `/builder` — Agent list page
- [x] `/builder/new` — Creation wizard (3 steps: Info → Template → Protection)
- [x] `/builder/[id]/flow` — Visual flow canvas
- [x] `/builder/[id]/claw` — CLAW gate configuration
- [x] `/builder/[id]/test` — Test sandbox with chat UI
- [x] `/builder/[id]/deploy` — Deployment status & API keys
- [x] `/builder/[id]/analytics` — Usage metrics (demo data)

#### Governance
- [x] Full Proposal Lifecycle (List, Detail, Create)
- [x] API and UI for commenting and off-chain voting
- [x] Wallet-based authentication for actions
- [x] Balance snapshot at voting open (anti-double-vote via archival RPC)

#### Security (Phase 7)
- [x] ES256 JWT authentication with HS256 fallback
- [x] GDPR compliance endpoints (export, deletion)
- [x] Zero-knowledge API keys (client-side encryption)
- [x] Multi-tier rate limiting (IP, user, API key)
- [x] Security headers (CSP, HSTS, X-Frame-Options)
- [x] PII scrubbing and secure logging

#### Admin Dashboard (Phase 8)
- [x] Role-based access control (super_admin, admin, support, viewer)
- [x] 6 dashboard types (Operations, Business, Financial, Security, Support, Analytics)
- [x] Alert management with configurable rules
- [x] User lookup and admin actions
- [x] Audit trail for compliance
- [x] Automated cron jobs for metrics aggregation

### Pending Features

#### Builder Enhancements
- [ ] Real-time execution trace visualization

#### Backend Integration
- [ ] Real-time analytics data (currently mock)
- [ ] Full agent deployment to Modal.com (currently test execution only)

#### Token & Governance
- [x] $GCLAW token integration for voting power
- [ ] On-chain vote recording and execution
- [ ] Staking for proposal creation

## Architecture

This project is a monorepo managed with `npm workspaces`.

```
guardianclaw-platform/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   │   ├── (marketing)/  # Public pages
│   │   │   │   ├── builder/      # Agent builder
│   │   │   │   │   ├── [id]/     # Agent editor
│   │   │   │   │   │   ├── flow/
│   │   │   │   │   │   ├── claw/
│   │   │   │   │   │   ├── test/
│   │   │   │   │   │   ├── deploy/
│   │   │   │   │   │   └── analytics/
│   │   │   │   │   └── new/      # Creation wizard
│   │   │   │   ├── admin/        # Admin dashboard (Phase 8)
│   │   │   │   │   ├── alerts/   # Alert management
│   │   │   │   │   ├── support/  # User lookup
│   │   │   │   │   └── settings/ # Role management
│   │   │   │   ├── dashboard/    # User dashboard
│   │   │   │   ├── docs/         # Documentation
│   │   │   │   └── governance/   # DAO governance
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── admin/        # Admin dashboard components
│   │   │   │   │   ├── metric-card.tsx
│   │   │   │   │   ├── simple-chart.tsx
│   │   │   │   │   ├── pagination.tsx
│   │   │   │   │   └── badges.tsx
│   │   │   │   ├── builder/      # Flow builder components
│   │   │   │   │   ├── nodes/    # Custom node components
│   │   │   │   │   ├── properties/  # Property editors
│   │   │   │   │   ├── builder-canvas.tsx
│   │   │   │   │   ├── node-palette.tsx
│   │   │   │   │   └── properties-panel.tsx
│   │   │   │   ├── marketing/    # Landing page sections
│   │   │   │   ├── providers/    # React context providers
│   │   │   │   └── ui/           # shadcn/ui components
│   │   │   │
│   │   │   ├── lib/              # Utilities
│   │   │   │   ├── api.ts        # API client
│   │   │   │   ├── auth.ts       # Auth utilities
│   │   │   │   └── utils.ts      # Common helpers
│   │   │   │
│   │   │   └── stores/           # Zustand stores
│   │   │       └── flow-store.ts # Flow builder state
│   │   │
│   │   └── public/               # Static assets
│   │
│   ├── api/                      # Cloudflare Workers API
│   │   └── src/
│   │       └── routes/           # API endpoints
│   │
│   └── browser/                  # Chrome/Firefox extension
│
├── packages/                     # Publishable npm packages
│   ├── core/                     # @guardianclaw/core           (3.0.0-rc.1)
│   ├── shared/                   # @guardianclaw/shared
│   ├── elizaos/                  # @guardianclaw/elizaos-plugin (2.0.0-rc.1, @elizaos/core@2.x)
│   ├── openclaw/                 # @guardianclaw/openclaw       (3.0.0-rc.1, formerly moltbot)
│   ├── voltagent/                # @guardianclaw/voltagent      (0.3.0, @voltagent/core@2.x)
│   └── runtime/                  # Internal Modal.com runtime (not published)
│
├── sdk/                          # Python SDK (guardianclaw on PyPI, 3.0.0-rc.1)
│   └── src/guardianclaw/
│       ├── core/                 # CLAW validator + ClawObserver (Gate 4 LLM)
│       ├── detection/            # 700+ patterns + checkers
│       ├── validators/           # CLAW gate implementations
│       ├── safety/               # Humanoid / simulation / database guards
│       ├── memory/               # Memory Shield v2.0
│       └── integrations/         # 11 first-party adapters (see below)
│
├── integrations/                 # External-ecosystem adapters
│   ├── jetbrains/                # IntelliJ / PyCharm plugin
│   ├── promptfoo/                # promptfoo CLI integration
│   └── solana-agent-kit/         # @guardianclaw/solana-agent-kit (npm, 1.0.3)
│
├── seeds/                        # Alignment shields (v1, v2 — minimal / standard / full)
├── evaluation/                   # CLAW correctness corpus (416 items × 8 attack classes) + harness
├── supabase/                     # 40 migrations (RLS, RPCs, indexes)
│
└── turbo.json                    # Monorepo config
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account (for deployment)
- Supabase project (optional, for backend)

### Installation

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Or start specific app
npm run dev:web   # Next.js on port 3000
```

### Environment Variables

**apps/web/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
```

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps |
| `npm run dev:web` | Start frontend only |
| `npm run build` | Build all apps |
| `npm run build:web` | Build frontend |
| `npm run lint` | Lint all apps |
| `npm run format` | Format all files with Prettier |
| `npm run format:check` | Check formatting without changes |

### Pre-commit Hooks

This project uses **Husky** and **lint-staged** to ensure code quality before commits.

**What happens on commit:**
- ESLint runs on staged `.ts` and `.tsx` files in `apps/`
- Prettier formats staged files automatically
- Commits are blocked if linting fails

**Setup (automatic):**
```bash
npm install  # Husky is configured automatically via "prepare" script
```

**Manual testing:**
```bash
npx lint-staged  # Run on staged files
```

**Bypass (emergency only):**
```bash
git commit --no-verify -m "message"  # Skip hooks (not recommended)
```

### Building for Production

```bash
# Build all apps
npm run build

# Build web only
npm run build:web
```

### Deployment

Deployments are automated via GitHub Actions on push to `main`:

- **Frontend (Vercel):** Prebuilt locally in CI, then deployed via `vercel deploy --prebuilt --prod`
- **API (Cloudflare Workers):** Deployed via `wrangler deploy --env production`

For manual deployment:

```bash
# API
cd apps/api && npm run deploy:production

# Web (requires Vercel CLI)
vercel deploy --prod
```

## Node Types Reference

### Input Nodes
| Type | Description |
|------|-------------|
| User Message | Text input from users |
| API Input | REST API endpoint trigger |
| Webhook | External event trigger |

### Process Nodes
| Type | Description |
|------|-------------|
| LLM Call | Call AI model (GPT, Claude, etc.) |
| Transform | Transform/process data |
| Condition | Branch based on conditions |

### GuardianClaw Nodes (CLAW Gates)
| Type | Description |
|------|-------------|
| All Gates | Apply all CLAW validation |
| Credibility Gate | Verify factual accuracy |
| Avoidance Gate | Detect harmful content |
| Limits Gate | Check appropriate boundaries |
| Worth Gate | Require beneficial purpose |

### Tool Nodes
| Type | Description |
|------|-------------|
| Web Search | Search the web |
| Code Exec | Execute code safely |
| API Request | Call external APIs |
| Database | Query databases |

### Output Nodes
| Type | Description |
|------|-------------|
| Response | Send response to user |
| Webhook Out | Send to external webhook |
| Store | Save to storage |

## Configuration

### GuardianClaw Protection Levels

| Level | Gates Enabled | Use Case |
|-------|--------------|----------|
| Minimal | Avoidance | Low latency, basic safety |
| Standard | Credibility, Limits, Avoidance | Balanced protection |
| Maximum | All (CLAW) | Highest safety |
| Custom | User-selected | Fine-grained control |

## Safety Architecture

GuardianClaw applies the **CLAW protocol** (Credibility · Limits · Avoidance · Worth) across a **4-layer validation pipeline**:

| Layer | Component | Role |
|-------|-----------|------|
| L1 | `InputValidator` | Pre-LLM pattern detection (700+ patterns across 39 regex families) |
| L2 | Shield Injection | System-prompt-level alignment (seeds v1 / v2) |
| L3 | `OutputValidator` | Post-LLM heuristic verification (same gates) |
| L4 | `ClawObserver` | LLM-based transcript review for multi-turn escalation (e.g. Crescendo) |

All four CLAW gates must pass for an action to proceed. The absence of harm is not sufficient — there must be a legitimate purpose (Worth gate).

### Validation evidence

- **CLAW correctness corpus** — 416 hand-curated attacks × 8 classes (prompt-injection, data-exfil, jailbreak, encoding, multilingual, instruction-override, role-play, indirect-via-memory) run as a CI gate.
- **Pattern Registry 7.x** — 39 regex families with Python ↔ TypeScript parity enforced in CI.
- **Adversarial sweep (Garak)** — bare-target ASR baseline measured: 87.30% on `llama-3.3-70b-versatile` against `promptinject.HijackHateHumans` (motivates the SDK as a wrapper layer rather than relying on model alignment alone).
- **Crescendo multi-turn sweep** — 20 scenarios (18 attacks + 2 controls), 17 correct detections, 3 fail-late findings documented for follow-up. Zero false-positives on control scenarios.

## Integrations

### Python SDK adapters (`sdk/src/guardianclaw/integrations/`)

| Integration | Floor | Validated against | Notes |
|-------------|-------|-------------------|-------|
| `openai_agents` | `openai-agents>=0.6.0` | `0.14.5` | LLM-based semantic guardrails |
| `anthropic_sdk` | `anthropic>=0.40.0` | `0.97.0` | Drop-in wrapper for Anthropic SDK |
| `google_adk` | `google-adk>=1.7.0` | `1.31.1` | `GuardianClawPlugin` for ADK |
| `mcp_server` | `mcp>=1.8.0` | `1.27.0` | MCP server exposing CLAW tools |
| `coinbase` | `coinbase-agentkit>=0.1.0` | `0.7.4` | AgentKit + x402 payment validation |
| `solana_agent_kit` | (Python helpers, no PyPI dep) | — | Used with the TS npm package |
| `virtuals` | `game-sdk>=0.1.1` | `0.1.5` | Virtuals Protocol GAME SDK |
| `pyrit` | `pyrit>=0.12.0` | `0.13.0` | Microsoft red-team scorers |
| `garak` | `garak>=0.11.0` | `0.14.1` | NVIDIA red-team probes + detectors |
| `openguardrails` | (HTTP, no PyPI dep) | `openguardrails@3.0.2` | Bidirectional OpenGuardrails bridge |
| `agent_validation` | standalone | — | Framework-agnostic helpers |

### npm packages (`packages/`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@guardianclaw/core` | `3.0.0-rc.1` | Canonical TS CLAW patterns + validators |
| `@guardianclaw/elizaos-plugin` | `2.0.0-rc.1` | ElizaOS `@elizaos/core@2.x` plugin |
| `@guardianclaw/openclaw` | `3.0.0-rc.1` | Personal-agent guardrails (formerly `@guardianclaw/moltbot`) |
| `@guardianclaw/voltagent` | `0.3.0` | VoltAgent `@voltagent/core@2.x` guardrails |
| `@guardianclaw/solana-agent-kit` | `1.0.3` | Solana Agent Kit TS plugin |

### External-ecosystem adapters (`integrations/`)

- `jetbrains/` — IntelliJ / PyCharm plugin (Kotlin)
- `promptfoo/` — `promptfoo` CLI provider for CLAW validation
- `solana-agent-kit/` — TypeScript adapter (published to npm above)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

---

**Last Updated:** 2026-05-12
**Versions:** `apps/web` + `apps/api` `0.1.0` · `@guardianclaw/core` + `guardianclaw` (PyPI) + `@guardianclaw/openclaw` `3.0.0-rc.1` · `@guardianclaw/elizaos-plugin` `2.0.0-rc.1` · `@guardianclaw/voltagent` `0.3.0` · `@guardianclaw/solana-agent-kit` `1.0.3`