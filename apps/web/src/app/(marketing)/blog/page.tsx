'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Newspaper, ArrowRight, Calendar, Clock, Tag } from 'lucide-react'
import { blogPosts, categories, getFeaturedPost, type BlogPost } from '@/lib/blog'
import { cn } from '@/lib/utils'

const categoryColors: Record<BlogPost['category'], { bg: string; text: string }> = {
  announcement: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  technical: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  research: { bg: 'bg-green-500/10', text: 'text-green-500' },
}

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

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const featuredPost = getFeaturedPost()

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'all') {
      return blogPosts.filter((post) => !post.featured)
    }
    return blogPosts.filter((post) => post.category === selectedCategory && !post.featured)
  }, [selectedCategory])

  return (
    <div className="py-16 lg:py-24">
      {/* Hero Section */}
      <section className="container mx-auto mb-16 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Newspaper className="h-4 w-4" />
            <span className="text-sm font-medium">Blog</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl">GuardianClaw Blog</h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Insights on AI safety, agent security, and the future of aligned AI systems.
          </p>
        </motion.div>
      </section>

      {/* Featured Post */}
      {featuredPost && (
        <section className="container mx-auto mb-16 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link href={`/blog/${featuredPost.slug}`} className="group block">
              <div className="from-claw-500/10 hover:border-claw-500/30 rounded-2xl border bg-gradient-to-br to-transparent p-8 transition-all lg:p-12">
                <div className="mb-6 flex items-center gap-4">
                  <span className="bg-claw-500 rounded-full px-3 py-1 text-xs font-medium text-white">
                    Featured
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium',
                      categoryColors[featuredPost.category].bg,
                      categoryColors[featuredPost.category].text
                    )}
                  >
                    {featuredPost.category.charAt(0).toUpperCase() + featuredPost.category.slice(1)}
                  </span>
                </div>

                <h2 className="group-hover:text-claw-500 mb-4 text-2xl font-bold transition-colors sm:text-3xl lg:text-4xl">
                  {featuredPost.title}
                </h2>

                <p className="text-muted-foreground mb-6 max-w-3xl text-lg">
                  {featuredPost.excerpt}
                </p>

                <div className="text-muted-foreground flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(featuredPost.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{featuredPost.readTime}</span>
                  </div>
                  <div className="text-claw-500 flex items-center gap-2 font-medium transition-all group-hover:gap-3">
                    Read article
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </section>
      )}

      {/* Category Filter */}
      <section className="container mx-auto mb-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center gap-3"
        >
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                selectedCategory === category.value
                  ? 'bg-claw-500 text-white'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              )}
            >
              {category.label}
            </button>
          ))}
        </motion.div>
      </section>

      {/* Posts Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredPosts.map((post) => (
            <motion.article key={post.slug} variants={itemVariants}>
              <Link href={`/blog/${post.slug}`} className="group block h-full">
                <div className="bg-background hover:border-claw-500/30 h-full rounded-2xl border p-6 transition-all hover:shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        categoryColors[post.category].bg,
                        categoryColors[post.category].text
                      )}
                    >
                      {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
                    </span>
                  </div>

                  <h3 className="group-hover:text-claw-500 mb-3 line-clamp-2 text-xl font-bold transition-colors">
                    {post.title}
                  </h3>

                  <p className="text-muted-foreground mb-6 line-clamp-3">{post.excerpt}</p>

                  <div className="text-muted-foreground mt-auto flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span>
                        {new Date(post.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>{post.readTime}</span>
                    </div>
                    <ArrowRight className="text-claw-500 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </motion.div>

        {filteredPosts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center"
          >
            <Tag className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No posts found in this category.</p>
          </motion.div>
        )}
      </section>

      {/* Subscribe CTA */}
      <section className="container mx-auto mt-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-muted/30 mx-auto max-w-3xl rounded-2xl border p-8 text-center"
        >
          <h2 className="mb-4 text-2xl font-bold">Stay Updated</h2>
          <p className="text-muted-foreground mb-6">
            Follow us on social media for the latest updates on AI safety and GuardianClaw
            development.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://x.com/guardianclaw_"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-background hover:border-claw-500/50 inline-flex items-center gap-2 rounded-lg border px-6 py-3 transition-colors"
            >
              Follow on X
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/guardianclaw/guardianclaw-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-background hover:border-claw-500/50 inline-flex items-center gap-2 rounded-lg border px-6 py-3 transition-colors"
            >
              Star on GitHub
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
