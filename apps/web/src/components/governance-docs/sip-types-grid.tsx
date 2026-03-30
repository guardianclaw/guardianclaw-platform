'use client'

import { motion } from 'framer-motion'
import { PROPOSAL_TYPES } from '@/lib/governance'
import { getTypeColor } from '@/lib/governance'

// Map SIP type codes to governance.tsx type keys for color lookup
const typeKeyMap: Record<string, string> = {
  'SIP-FEATURE': 'feature',
  'SIP-GOV': 'governance',
  'SIP-SEED': 'seed',
  'SIP-DOCS': 'docs',
  'SIP-PARTNER': 'partnership',
  'SIP-META': 'meta',
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function SipTypesGrid() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {PROPOSAL_TYPES.map((item) => {
        const colorKey = typeKeyMap[item.type] || 'meta'
        const colorClasses = getTypeColor(colorKey)
        // Extract just the text color from the combined class string
        const textColor =
          colorClasses.split(' ').find((c) => c.startsWith('text-')) || 'text-zinc-400'

        return (
          <motion.div
            key={item.type}
            variants={itemVariants}
            className="bg-background hover:border-claw-500/30 rounded-2xl border p-5 transition-all"
          >
            <div className={`mb-2 font-mono text-sm font-semibold ${textColor}`}>{item.type}</div>
            <h4 className="mb-2 text-sm font-semibold">{item.label}</h4>
            <p className="text-muted-foreground mb-3 text-xs">{item.description}</p>
            <div className="flex gap-3 text-xs">
              <div className="bg-muted/50 rounded px-2 py-1">
                Quorum: <span className="font-medium">{item.quorum}%</span>
              </div>
              <div className="bg-muted/50 rounded px-2 py-1">
                Majority: <span className="font-medium">{item.majority}%</span>
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
