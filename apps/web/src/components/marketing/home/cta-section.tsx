'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Github, Book } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="from-claw-500/5 absolute inset-0 bg-gradient-to-br via-transparent to-purple-500/5" />
        <div className="bg-claw-500/10 absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center">
              <Image
                src="/favicon.svg"
                alt="GuardianClaw"
                width={120}
                height={160}
                className="drop-shadow-[0_0_20px_rgba(34,197,94,0.2)]"
              />
            </div>
          </motion.div>

          {/* Headline */}
          <h2 className="mb-6 text-3xl font-bold sm:text-4xl lg:text-5xl">
            Ready to Build Safer AI?
          </h2>

          {/* Description */}
          <p className="text-muted-foreground mx-auto mb-10 max-w-xl text-lg">
            Join thousands of developers building AI systems with enterprise-grade safety. Get
            started in minutes with our free tier.
          </p>

          {/* Primary CTAs */}
          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="group w-full sm:w-auto" asChild>
              <Link href="/app/builder">
                Start Building Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/docs">
                <Book className="mr-2 h-4 w-4" />
                Read Documentation
              </Link>
            </Button>
          </div>

          {/* Secondary Links */}
          <div className="flex items-center justify-center gap-8 text-sm">
            <a
              href="https://github.com/guardianclaw/guardianclaw-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </a>
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              View Docs
            </Link>
            <Link
              href="/integrations"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse Integrations
            </Link>
          </div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-16 border-t pt-12"
          >
            <p className="text-muted-foreground mb-6 text-sm">
              Trusted by teams building the future of AI
            </p>
            <div className="flex items-center justify-center gap-8 opacity-50">
              {/* Placeholder for future customer logos */}
              <div className="bg-muted h-8 w-24 rounded" />
              <div className="bg-muted h-8 w-24 rounded" />
              <div className="bg-muted h-8 w-24 rounded" />
              <div className="bg-muted hidden h-8 w-24 rounded sm:block" />
              <div className="bg-muted hidden h-8 w-24 rounded md:block" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
