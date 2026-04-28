'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Lock,
  FileText,
  Github,
  Clock,
  ArrowRight,
  MessageCircle,
  Twitter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

const subjectOptions = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'security', label: 'Security' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'support', label: 'Support' },
  { value: 'other', label: 'Other' },
]

const infoCards = [
  {
    icon: Mail,
    title: 'Email',
    description: 'For all inquiries, partnerships and security reports',
    action: { label: 'contact@guardianclaw.org', href: 'mailto:contact@guardianclaw.org' },
  },
  {
    icon: Github,
    title: 'GitHub',
    description: 'Bug reports, feature requests and source code',
    action: { label: 'guardianclaw/guardianclaw-platform', href: 'https://github.com/guardianclaw/guardianclaw-platform' },
    external: true,
  },
  {
    icon: Clock,
    title: 'Response Time',
    description: 'We typically respond within 2-3 business days',
  },
]

const socialLinks = [
  { icon: Twitter, label: 'X (Twitter)', href: 'https://x.com/guardianclaw_' },
  { icon: Mail, label: 'Email', href: 'mailto:contact@guardianclaw.org' },
  { icon: Github, label: 'GitHub', href: 'https://github.com/guardianclaw/guardianclaw-platform' },
  { icon: HuggingFaceIcon, label: 'HuggingFace', href: 'https://huggingface.co/guardianclaw' },
  { icon: MessageCircle, label: 'Telegram', href: 'https://t.me/clawofficial_ai' },
]

// Custom icon since lucide doesn't have a HuggingFace icon
function HuggingFaceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

const crossLinks = [
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Explore guides and API reference',
    href: '/docs',
  },
  {
    icon: Lock,
    title: 'Security',
    description: 'Security practices and disclosure',
    href: '/security',
  },
  {
    icon: FileText,
    title: 'Whitepaper',
    description: 'Read the GuardianClaw whitepaper',
    href: '/whitepaper',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactPage() {
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const isValid =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    subject !== '' &&
    message.trim().length >= 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setFormState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Request failed (${res.status})`)
      }

      setSubmittedEmail(email)
      setFormState('success')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      )
      setFormState('error')
    }
  }

  function resetForm() {
    setName('')
    setEmail('')
    setSubject('')
    setMessage('')
    setFormState('idle')
    setErrorMessage('')
  }

  return (
    <div className="py-16 lg:py-24">
      {/* Hero */}
      <section className="container mx-auto mb-16 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">Contact</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">Get in Touch</h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Have a question, partnership proposal, or security report? We&apos;d love to hear from
            you.
          </p>
        </motion.div>
      </section>

      {/* Form + Info Grid */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-5 lg:gap-12">
            {/* Form Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-3"
            >
              <div className="bg-background rounded-2xl border p-6 sm:p-8">
                {formState === 'success' ? (
                  <div className="py-12 text-center">
                    <div className="bg-claw-500/10 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full">
                      <CheckCircle2 className="text-claw-500 h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-2xl font-bold">Message Sent!</h3>
                    <p className="text-muted-foreground mb-6">
                      We&apos;ll respond to{' '}
                      <span className="text-foreground font-medium">{submittedEmail}</span> within
                      2-3 business days.
                    </p>
                    <Button variant="outline" onClick={resetForm}>
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Name
                      </label>
                      <Input
                        id="name"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={2}
                        maxLength={100}
                        disabled={formState === 'submitting'}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={formState === 'submitting'}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-medium">
                        Subject
                      </label>
                      <Select
                        value={subject}
                        onValueChange={setSubject}
                        disabled={formState === 'submitting'}
                      >
                        <SelectTrigger id="subject">
                          <SelectValue placeholder="Select a topic" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjectOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-medium">
                        Message
                      </label>
                      <Textarea
                        id="message"
                        placeholder="Tell us more (minimum 10 characters)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        minLength={10}
                        maxLength={5000}
                        rows={6}
                        disabled={formState === 'submitting'}
                      />
                    </div>

                    {formState === 'error' && errorMessage && (
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={!isValid || formState === 'submitting'}
                    >
                      {formState === 'submitting' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>

            {/* Info Column */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="space-y-4 lg:col-span-2"
            >
              {infoCards.map((card) => (
                <motion.div
                  key={card.title}
                  variants={itemVariants}
                  className="bg-background rounded-2xl border p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-claw-500/10 shrink-0 rounded-xl p-2.5">
                      <card.icon className="text-claw-500 h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">{card.title}</h3>
                      <p className="text-muted-foreground mb-2 text-sm">{card.description}</p>
                      {card.action && (
                        <a
                          href={card.action.href}
                          className="text-claw-500 text-sm font-medium hover:underline"
                          {...(card.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                        >
                          {card.action.label}
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Social Links */}
              <motion.div variants={itemVariants} className="bg-background rounded-2xl border p-6">
                <h3 className="mb-4 font-semibold">Find Us</h3>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:border-claw-500/40 hover:bg-claw-500/5 text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3"
          >
            {crossLinks.map((link) => (
              <motion.div key={link.title} variants={itemVariants}>
                <Link
                  href={link.href}
                  className="bg-background hover:border-claw-500/40 group block rounded-2xl border p-6 transition-colors"
                >
                  <div className="bg-claw-500/10 mb-4 inline-block rounded-xl p-2.5">
                    <link.icon className="text-claw-500 h-5 w-5" />
                  </div>
                  <h3 className="group-hover:text-claw-500 mb-1 font-semibold transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-muted-foreground mb-3 text-sm">{link.description}</p>
                  <span className="text-claw-500 inline-flex items-center text-sm font-medium">
                    Learn more <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  )
}
