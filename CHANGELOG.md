# Changelog

All notable changes to the GuardianClaw Platform v3.

## [3.0.0-beta] - 2025-01-06

### Added

#### Builder System (N8N Style)
- Visual flow canvas with React Flow (@xyflow/react)
- Drag-and-drop node palette with 5 categories:
  - Input: User Message, API Input, Webhook
  - Process: LLM Call, Transform, Condition
  - GuardianClaw: All Gates, Credibility, Limits, Avoidance, Worth
  - Tools: Web Search, Code Exec, API Request, Database
  - Output: Response, Webhook Out, Store
- Custom node components with visual styling
- Node connections with animated smooth-step edges
- Properties panel for node configuration
- Minimap and zoom controls
- Grid snap (16px)
- Zustand store for flow state management

#### Builder Routes
- `/builder` - Agent list page with demo card
- `/builder/new` - 3-step creation wizard (Info, Template, Protection)
- `/builder/[id]/flow` - Visual flow canvas
- `/builder/[id]/claw` - CLAW protection configuration
- `/builder/[id]/test` - Chat-based test sandbox with execution trace
- `/builder/[id]/deploy` - Deployment status, API keys, code examples
- `/builder/[id]/analytics` - Usage metrics dashboard (mock data)

#### Demo Mode
- Pre-configured demo agent with 5-node flow
- Demo banner indicating non-persistent mode
- Full builder functionality without authentication

#### UI Components
- Switch component (Radix UI)
- Radio Group component (Radix UI)
- Tooltip component (Radix UI)
- Custom handles for React Flow nodes

### Fixed
- Next.js 15 params type compatibility (Promise-based params)
- Server/Client component separation for static export
- Context export conflict in layout files
- Hydration mismatch with dynamic dates
- Zustand persist compatibility with SSR

### Changed
- Upgraded to Next.js 15
- Migrated to @xyflow/react from react-flow-renderer
- Static export configuration for Cloudflare Pages
- Separated AgentContext into dedicated context.tsx file

### Technical Notes
- Static export requires `generateStaticParams` for dynamic routes
- Only `/builder/demo/*` routes are pre-rendered
- Real agent IDs require runtime rendering (not currently supported in static mode)

## [2.x.x] - Previous Version

See legacy documentation for previous versions.
