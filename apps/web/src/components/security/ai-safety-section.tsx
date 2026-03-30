'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CLAWProtocol = dynamic(
  () => import('@/components/whitepaper/diagrams/CLAWProtocol').then((m) => m.CLAWProtocol),
  { ssr: false, loading: () => <DiagramSkeleton /> }
)

const FourLayerArchitecture = dynamic(
  () =>
    import('@/components/whitepaper/diagrams/FourLayerArchitecture').then(
      (m) => m.FourLayerArchitecture
    ),
  { ssr: false, loading: () => <DiagramSkeleton /> }
)

function DiagramSkeleton() {
  return (
    <div className="bg-muted/30 flex h-[400px] w-full animate-pulse items-center justify-center rounded-xl border">
      <span className="text-muted-foreground text-sm">Loading diagram...</span>
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function AISafetySection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">AI Safety Architecture</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Every AI decision passes through our validation pipeline before it becomes an action.
              Two core mechanisms ensure safety.
            </p>
          </motion.div>

          {/* CLAW Protocol */}
          <motion.div variants={itemVariants} className="mb-20">
            <div className="mx-auto max-w-5xl">
              <div className="mb-8">
                <h3 className="mb-3 text-2xl font-bold">CLAW Protocol</h3>
                <p className="text-muted-foreground max-w-2xl">
                  Four gates that every decision must pass: Credibility, Avoidance, Limits, and
                  Worth. The absence of harm is not sufficient — there must be genuine worth.
                </p>
              </div>
              <div className="bg-background rounded-2xl border p-4 sm:p-6">
                <CLAWProtocol autoPlay={false} interactive={true} />
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/whitepaper#claw">
                    Read in Whitepaper <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* 4-Layer Architecture */}
          <motion.div variants={itemVariants}>
            <div className="mx-auto max-w-5xl">
              <div className="mb-8">
                <h3 className="mb-3 text-2xl font-bold">4-Layer Validation Architecture</h3>
                <p className="text-muted-foreground max-w-2xl">
                  L1 Input validation catches attacks before the AI sees them. L2 Seed injection
                  aligns behavior. L3 Output validation checks responses. L4 Observer analyzes full
                  transcripts.
                </p>
              </div>
              <div className="bg-background rounded-2xl border p-4 sm:p-6">
                <FourLayerArchitecture autoPlay={false} interactive={true} />
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/docs">
                    View Documentation <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
