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
- **Turborepo** — Monorepo orchestration

## Current Status

**Live URLs:**
- Frontend: https://guardianclaw.org
- API: https://claw-api-production.guardianclaw.workers.dev/health

**CI/CD:** GitHub Actions (Lint, TypeCheck, Test, Build, Deploy)

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
│   └── api/                      # Cloudflare Workers API
│       └── src/
│           └── routes/           # API endpoints
│
├── packages/
│   ├── core/                     # @guardianclaw/core
│   ├── shared/                   # @guardianclaw/shared
│   ├── openclaw/                  # @guardianclaw/openclaw
│   ├── voltagent/                # @guardianclaw/voltagent
│   ├── elizaos/                  # @guardianclaw/elizaos-plugin
│   ├── goat-plugin/              # @goat-sdk/plugin-claw
│   ├── vscode/                   # VS Code extension
│   └── runtime/                  # Modal.com runtime
│
├── sdk/                          # Python SDK (guardianclaw)
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

## Integration Roadmap

### Completed Integrations

| Phase | Integrations | Status |
|-------|-------------|--------|
| Phase 1 | OpenAI Agents SDK | COMPLETE |
| Phase 2 | Coinbase AgentKit, Solana Agent Kit | COMPLETE |
| Phase 3 | Google ADK, Virtuals Protocol (GAME) | COMPLETE |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

---

**Last Updated:** 2026-04-01
**Version:** 0.1.0