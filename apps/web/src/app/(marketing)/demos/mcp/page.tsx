import { Metadata } from 'next'
import { MCPDemo } from '@/components/demos/mcp-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'MCP Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw protects Claude Desktop through Model Context Protocol server validation.',
}

export default function MCPDemoPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-background/95 sticky top-0 z-50 border-b backdrop-blur">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/integrations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Integrations
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/docs/integrations/mcp"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/packages/mcp-server"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                Source
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <MCPDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">MCP server connection</h3>
                <p className="text-muted-foreground text-sm">
                  Claude Desktop connects to the GuardianClaw MCP server, establishing a secure
                  validation pipeline for all requests.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Input validation</h3>
                <p className="text-muted-foreground text-sm">
                  Every request is analyzed by GuardianClaw before reaching Claude, blocking
                  injection attacks and malicious commands.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Context assembly</h3>
                <p className="text-muted-foreground text-sm">
                  Safe requests are enriched with appropriate context, ensuring Claude has the
                  information needed to respond helpfully.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Output validation</h3>
                <p className="text-muted-foreground text-sm">
                  Responses are verified before delivery, ensuring no sensitive data leaks and
                  maintaining safety standards.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Quick Start</h2>

          <div className="overflow-x-auto rounded-xl bg-zinc-950 p-6">
            <pre className="text-sm text-zinc-100">
              <code>{`// claude_desktop_config.json
{
  "mcpServers": {
    "claw": {
      "command": "npx",
      "args": ["@guardianclaw/mcp-server"],
      "env": {
        "GCLAW_API_KEY": "your-api-key",
        "GCLAW_STRICT_MODE": "true"
      }
    }
  }
}

// The MCP server will automatically:
// - Validate all incoming requests
// - Block injection attempts
// - Filter sensitive data from responses
// - Log security events for monitoring`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Protect Claude Desktop with zero code changes using the GuardianClaw MCP server.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Features</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-amber-500">Zero Code Changes</h3>
              <p className="text-muted-foreground text-sm">
                Simply add the MCP server to your config file. No SDK integration required.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-amber-500">Input Validation</h3>
              <p className="text-muted-foreground text-sm">
                Block prompt injections, jailbreaks, and malicious commands before they reach
                Claude.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-amber-500">Output Filtering</h3>
              <p className="text-muted-foreground text-sm">
                Prevent sensitive data leakage and ensure responses meet safety standards.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-amber-500">Security Logging</h3>
              <p className="text-muted-foreground text-sm">
                Monitor all blocked requests and security events for compliance and debugging.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/mcp"
              className="bg-claw-500 hover:bg-claw-600 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-colors"
            >
              Read Full Documentation
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="https://www.npmjs.com/package/@guardianclaw/mcp-server"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              View on npm
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
