'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useCases, getUseCaseColors } from '@/lib/use-cases'
import { cn } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
}

export function UseCasesSection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Built for Every Industry</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            From DeFi trading bots to industrial robots, GuardianClaw protects AI systems across
            every domain with industry-specific safety profiles.
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-6 md:grid-cols-3"
        >
          {useCases.map((useCase) => {
            const Icon = useCase.icon
            const colors = getUseCaseColors(useCase.color)

            return (
              <motion.div key={useCase.slug} variants={itemVariants}>
                <Link href={`/use-cases/${useCase.slug}`} className="group block h-full">
                  <div
                    className={cn(
                      'relative h-full overflow-hidden rounded-2xl border p-8',
                      'transition-all duration-300',
                      'hover:border-transparent hover:shadow-xl'
                    )}
                  >
                    {/* Background gradient */}
                    <div
                      className={cn(
                        'absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                        'bg-gradient-to-br',
                        colors.gradient
                      )}
                    />

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Icon */}
                      <div
                        className={cn(
                          'mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl',
                          colors.bg
                        )}
                      >
                        <Icon className={cn('h-7 w-7', colors.text)} />
                      </div>

                      {/* Title and tagline */}
                      <h3 className="group-hover:text-claw-500 mb-2 text-xl font-bold transition-colors">
                        {useCase.name}
                      </h3>
                      <p className="text-muted-foreground mb-6">{useCase.tagline}</p>

                      {/* Challenge preview */}
                      <div className="mb-6">
                        <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                          Key challenges
                        </div>
                        <ul className="space-y-1.5">
                          {useCase.challenge.problems.slice(0, 3).map((problem) => (
                            <li
                              key={problem}
                              className="text-muted-foreground flex items-start gap-2 text-sm"
                            >
                              <span className="mt-0.5 text-red-500">•</span>
                              {problem}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Link */}
                      <div className="text-claw-600 dark:text-claw-400 flex items-center gap-2 text-sm font-medium">
                        Learn more
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
