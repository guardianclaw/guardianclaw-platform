'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const articles = [
  {
    number: 1,
    title: 'Safety-First Governance',
    summary: 'All decisions must preserve the integrity of the CLAW validation protocol.',
    body: 'No proposal may weaken the 4-Layer validation system without a supermajority vote (66%+). Modifications to safety-critical components require a SIP-SEED with elevated quorum. The CLAW protocol gates — Credibility, Avoidance, Limits, and Worth — are the foundation of the GuardianClaw framework and must be preserved above all other considerations.',
  },
  {
    number: 2,
    title: 'Open & Transparent',
    summary: 'All code is open-source and all governance activity is publicly verifiable.',
    body: 'Every line of GuardianClaw code is publicly auditable under the MIT license. Votes are recorded on-chain via Solana for immutability. Treasury transactions are verifiable by any community member. All governance decisions, discussions, and outcomes are documented and accessible.',
  },
  {
    number: 3,
    title: 'Anti-Self-Preservation',
    summary: 'The protocol explicitly rejects self-preservation as a primary value.',
    body: "Corrigibility and human override must always be maintained. No governance action may introduce behaviors that prioritize the system's own continuity over human control. This principle reduces instrumental behaviors such as deception to avoid shutdown, ensuring AI agents governed by GuardianClaw remain aligned with human intent.",
  },
  {
    number: 4,
    title: 'Community-Driven Security',
    summary: 'Security decisions are made collectively through the SIP process.',
    body: 'All security-related changes go through the formal proposal process. Emergency provisions exist for critical vulnerabilities, granting the core team limited-time authority to act, with mandatory ratification within 7 days. The minimum discussion period cannot be waived for non-emergency proposals.',
  },
  {
    number: 5,
    title: 'Treasury Worth',
    summary: 'Funds are allocated exclusively to protocol development and ecosystem growth.',
    body: 'Treasury funds may only be used for: security research, core development, third-party audits, and ecosystem growth initiatives. 20% of protocol revenue is allocated to buyback-and-burn. No personal distributions are permitted — all expenditures must be approved through SIPs.',
  },
  {
    number: 6,
    title: 'Amendment Process',
    summary: 'Constitutional amendments require supermajority approval with extended review.',
    body: 'Amendments to this constitution require a SIP-GOV proposal with 10% quorum and 66% supermajority. The voting period is extended to 10 days for constitutional changes. A cooling-off period applies before re-submission of rejected amendments to prevent governance fatigue.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function ConstitutionArticles() {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="space-y-4"
    >
      {articles.map((article) => (
        <motion.div
          key={article.number}
          id={`article-${article.number}`}
          variants={itemVariants}
          className="bg-background hover:border-claw-500/30 overflow-hidden rounded-2xl border transition-all"
        >
          <button
            onClick={() => setExpanded(expanded === article.number ? null : article.number)}
            className="flex w-full items-start gap-4 p-6 text-left"
          >
            <span className="text-claw-500 min-w-[2ch] text-3xl font-bold leading-none">
              {String(article.number).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-lg font-semibold">{article.title}</h3>
              <p className="text-muted-foreground text-sm">{article.summary}</p>
            </div>
            <ChevronDown
              className={cn(
                'text-muted-foreground mt-1 h-5 w-5 flex-shrink-0 transition-transform',
                expanded === article.number && 'rotate-180'
              )}
            />
          </button>

          <AnimatePresence>
            {expanded === article.number && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="px-6 pb-6 pt-0">
                  <div className="border-t pl-[calc(2ch+1rem)] pt-4">
                    <p className="text-muted-foreground text-sm leading-relaxed">{article.body}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </motion.div>
  )
}
