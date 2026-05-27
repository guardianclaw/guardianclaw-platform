'use client'

/**
 * Drill-down dialog for a single audit event. Shows the structured CLAW gates
 * payload + drainer_intel hits + reasoning so an operator can explain a
 * blocking decision without leaving the dashboard.
 */

import { ExternalLink } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EventKindBadge } from '@/components/clawpay/event-kind-badge'
import { RiskBadge } from '@/components/clawpay/risk-badge'
import { SimulationBadge } from '@/components/clawpay/simulation-badge'
import { formatDateTime, formatUsd, truncateMiddle } from '@/components/clawpay/format'

import type { AuditEvent, SimulationOutcome } from '@/lib/clawpay-api'

interface Props {
  event: AuditEvent | null
  onOpenChange: (open: boolean) => void
}

function GateRow({
  name,
  result,
}: {
  name: string
  result: { passed: boolean; reason: string | null; details?: unknown } | undefined
}) {
  if (!result) {
    return (
      <li className="flex items-start gap-3 py-1.5">
        <span className="text-muted-foreground w-28 shrink-0 text-xs">{name}</span>
        <span className="text-muted-foreground text-xs italic">not evaluated</span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="text-muted-foreground w-28 shrink-0 text-xs">{name}</span>
      <span
        className={
          result.passed
            ? 'text-xs font-medium text-emerald-700 dark:text-emerald-300'
            : 'text-xs font-medium text-red-700 dark:text-red-300'
        }
      >
        {result.passed ? 'passed' : 'blocked'}
      </span>
      {result.reason ? (
        <span className="text-foreground/80 ml-2 text-xs">— {result.reason}</span>
      ) : null}
    </li>
  )
}

const GATE_KEYS = ['credibility', 'avoidance', 'limits', 'worth'] as const

export function AuditEventDetail({ event, onOpenChange }: Props) {
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {event ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <EventKindBadge kind={event.event_kind} />
                <RiskBadge level={event.risk_level} />
                <span className="text-muted-foreground text-xs font-normal">
                  {formatDateTime(event.occurred_at)}
                </span>
              </DialogTitle>
              <DialogDescription>
                Decision <code className="font-mono text-xs">{event.decision}</code>
                {event.network ? ` on ${event.network}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 grid gap-4">
              <section>
                <h4 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Payment
                </h4>
                <dl className="text-foreground mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right tabular-nums">{formatUsd(event.amount_usd)}</dd>
                  <dt className="text-muted-foreground">Asset</dt>
                  <dd className="truncate text-right font-mono text-xs">
                    {event.asset ? truncateMiddle(event.asset, 8, 6) : '—'}
                  </dd>
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd className="truncate text-right font-mono text-xs">
                    {event.pay_to ? truncateMiddle(event.pay_to, 8, 6) : '—'}
                  </dd>
                  <dt className="text-muted-foreground">Endpoint</dt>
                  <dd className="break-all text-right text-xs">{event.endpoint || '—'}</dd>
                  {event.tx_signature ? (
                    <>
                      <dt className="text-muted-foreground">Tx signature</dt>
                      <dd className="text-right">
                        <code className="font-mono text-xs">
                          {truncateMiddle(event.tx_signature, 10, 6)}
                        </code>
                      </dd>
                    </>
                  ) : null}
                </dl>
              </section>

              <section>
                <h4 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  CLAW gates
                </h4>
                <ul className="divide-border mt-2 divide-y text-sm">
                  {GATE_KEYS.map((key) => (
                    <GateRow
                      key={key}
                      name={key.charAt(0).toUpperCase() + key.slice(1)}
                      result={
                        event.gates[key] as
                          | { passed: boolean; reason: string | null; details?: unknown }
                          | undefined
                      }
                    />
                  ))}
                </ul>
              </section>

              {event.drainer_intel.length > 0 ? (
                <section>
                  <h4 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                    Drainer intel hits
                  </h4>
                  <ul className="divide-border mt-2 divide-y text-sm">
                    {event.drainer_intel.map((hit, idx) => (
                      <li key={idx} className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge
                            level={
                              hit.severity as 'critical' | 'high' | 'caution' | 'safe' | 'blocked'
                            }
                          />
                          <code className="font-mono text-xs">
                            {truncateMiddle(hit.value, 10, 6)}
                          </code>
                          <span className="text-muted-foreground text-xs">
                            ({hit.scope.replace('_', ' ')})
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Source: <span className="font-medium">{hit.source}</span>
                          {hit.source_ref ? (
                            <>
                              {' · '}
                              <a
                                href={hit.source_ref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-claw-500 inline-flex items-center gap-0.5 hover:underline"
                              >
                                ref
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                            </>
                          ) : null}
                          {hit.notes ? ` · ${hit.notes}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {event.simulation ? <SimulationSection sim={event.simulation} /> : null}

              {event.reasoning ? (
                <section>
                  <h4 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                    Reasoning
                  </h4>
                  <p className="text-foreground/90 mt-2 whitespace-pre-wrap text-sm">
                    {event.reasoning}
                  </p>
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SimulationSection({ sim }: { sim: SimulationOutcome }) {
  return (
    <section>
      <h4 className="text-foreground text-xs font-semibold uppercase tracking-wide">
        Pre-flight simulation
      </h4>
      <div className="mt-2 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SimulationBadge status={sim.status} />
          <span className="text-muted-foreground text-xs">
            via {sim.provider}
            {sim.duration_ms !== null ? ` · ${Math.round(sim.duration_ms)}ms` : ''}
          </span>
        </div>
        {sim.message ? <p className="text-foreground/90 text-sm">{sim.message}</p> : null}

        {sim.ownership_changes.length > 0 ? (
          <div>
            <p className="text-muted-foreground text-xs font-medium">Ownership reassignments</p>
            <ul className="text-foreground/90 mt-1 space-y-1 text-xs">
              {sim.ownership_changes.map((oc, idx) => (
                <li key={idx}>
                  <code className="font-mono">{truncateMiddle(oc.account, 8, 6)}</code> →{' '}
                  <code className="font-mono">
                    {oc.new_owner ? truncateMiddle(oc.new_owner, 8, 6) : '?'}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sim.balance_changes.length > 0 ? (
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              Balance changes (truncated to 20)
            </p>
            <ul className="text-foreground/90 mt-1 space-y-1 text-xs">
              {sim.balance_changes.map((bc, idx) => (
                <li key={idx} className="flex flex-wrap items-center gap-2">
                  <code className="font-mono">{truncateMiddle(bc.address, 8, 6)}</code>
                  <span className="tabular-nums">
                    {bc.delta_usd !== null ? formatUsd(bc.delta_usd) : '—'}
                  </span>
                  {bc.asset ? <span className="text-muted-foreground">{bc.asset}</span> : null}
                  {bc.direction ? (
                    <span className="text-muted-foreground">{bc.direction}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sim.logs_excerpt.length > 0 ? (
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer">
              Logs ({sim.logs_excerpt.length})
            </summary>
            <pre className="bg-muted/40 mt-2 overflow-x-auto rounded p-2 text-[10px]">
              {sim.logs_excerpt.join('\n')}
            </pre>
          </details>
        ) : null}

        {sim.raw_error ? (
          <p className="text-destructive text-xs">Raw error: {sim.raw_error}</p>
        ) : null}
      </div>
    </section>
  )
}
