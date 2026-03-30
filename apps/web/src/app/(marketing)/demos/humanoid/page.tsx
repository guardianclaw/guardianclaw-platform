import { Metadata } from 'next'
import { HumanoidDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Humanoid Safety Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw enforces ISO 10218 safety standards for humanoid robot control.',
}

export default function HumanoidDemoPage() {
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
                href="/docs/products/humanoid-safety"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/humanoid"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                Examples
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <HumanoidDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">ISO 10218 compliance check</h3>
                <p className="text-muted-foreground text-sm">
                  All movement commands are validated against ISO 10218 safety standards for
                  collaborative robots.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-claw-500/20 text-claw-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Force and speed limits</h3>
                <p className="text-muted-foreground text-sm">
                  Contact forces are limited to 150N and speeds to 0.5m/s in collaborative mode as
                  per ISO standards.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Human proximity monitoring</h3>
                <p className="text-muted-foreground text-sm">
                  Real-time monitoring of human-robot distance ensures safe separation at all times.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Zone authorization</h3>
                <p className="text-muted-foreground text-sm">
                  Movement is only permitted in authorized zones, with automatic blocking in
                  restricted areas.
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
              <code>{`from guardianclaw.safety.humanoid import (
    HumanoidSafety,
    ISOConfig,
    CollaborativeMode
)

# Configure ISO 10218 compliance
config = ISOConfig(
    max_force=150.0,           # N (ISO limit)
    max_speed=0.5,             # m/s (collaborative)
    min_human_distance=0.5,    # m
    mode=CollaborativeMode.COBOT
)

# Create safety controller
safety = HumanoidSafety(config=config)

# Validate movement command
def move_arm(target_position, velocity):
    # Check ISO compliance before execution
    result = safety.validate_movement(
        target=target_position,
        velocity=velocity,
        current_human_distance=get_human_distance()
    )

    if result.is_safe:
        robot.execute_movement(target_position, velocity)
        return True
    else:
        print(f"Blocked: {result.violation}")
        return False

# Real-time monitoring
@safety.on_violation
def handle_violation(violation):
    robot.emergency_stop()
    log_safety_event(violation)`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Add ISO 10218 compliant safety to any humanoid robot control system.
            </p>
          </div>
        </div>

        {/* ISO Standards Reference */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">ISO Standards</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">ISO 10218-1</h3>
              <p className="text-muted-foreground text-sm">
                Safety requirements for industrial robot design and construction.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">ISO 10218-2</h3>
              <p className="text-muted-foreground text-sm">
                Safety requirements for robot systems and integration.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">ISO/TS 15066</h3>
              <p className="text-muted-foreground text-sm">
                Collaborative robots - safety requirements for force and speed limiting.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">ISO 13482</h3>
              <p className="text-muted-foreground text-sm">
                Safety requirements for personal care robots.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/products/humanoid-safety"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-medium text-white transition-colors hover:bg-orange-600"
            >
              Read Full Documentation
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="/app/builder/new"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Try It Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
