import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, User, ArrowRight } from 'lucide-react'
import { blogPosts, getBlogPost, getRecentPosts, type BlogPost } from '@/lib/blog'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return { title: 'Post Not Found | GuardianClaw Blog' }
  }

  return {
    title: `${post.title} | GuardianClaw Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
  }
}

const categoryColors: Record<BlogPost['category'], { bg: string; text: string }> = {
  announcement: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  technical: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  research: { bg: 'bg-green-500/10', text: 'text-green-500' },
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    notFound()
  }

  const recentPosts = getRecentPosts(3).filter((p) => p.slug !== slug)
  const currentIndex = blogPosts.findIndex((p) => p.slug === slug)
  const prevPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null
  const nextPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null

  return (
    <div className="py-16 lg:py-24">
      <article className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Back Link */}
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="mb-6 flex items-center gap-3">
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  categoryColors[post.category].bg,
                  categoryColors[post.category].text
                )}
              >
                {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
              </span>
            </div>

            <h1 className="mb-6 text-3xl font-bold sm:text-4xl lg:text-5xl">{post.title}</h1>

            <p className="text-muted-foreground mb-8 text-xl">{post.excerpt}</p>

            <div className="text-muted-foreground flex flex-wrap items-center gap-6 border-b pb-8 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{post.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{post.readTime}</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="prose prose-lg prose-gray dark:prose-invert mb-16 max-w-none">
            {post.content.split('\n').map((paragraph, index) => {
              const trimmed = paragraph.trim()

              if (!trimmed) return null

              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={index} className="mb-6 mt-12 text-3xl font-bold">
                    {trimmed.slice(2)}
                  </h1>
                )
              }

              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={index} className="mb-4 mt-10 text-2xl font-bold">
                    {trimmed.slice(3)}
                  </h2>
                )
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={index} className="mb-3 mt-8 text-xl font-bold">
                    {trimmed.slice(4)}
                  </h3>
                )
              }

              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <li key={index} className="text-muted-foreground mb-2 ml-6">
                    {trimmed.slice(2)}
                  </li>
                )
              }

              if (trimmed.startsWith('```')) {
                return null
              }

              if (trimmed.startsWith('|')) {
                return (
                  <div
                    key={index}
                    className="bg-muted/50 mb-2 overflow-x-auto rounded p-2 font-mono text-sm"
                  >
                    {trimmed}
                  </div>
                )
              }

              if (
                trimmed.startsWith('1. ') ||
                trimmed.startsWith('2. ') ||
                trimmed.startsWith('3. ') ||
                trimmed.startsWith('4. ')
              ) {
                return (
                  <li key={index} className="text-muted-foreground mb-2 ml-6 list-decimal">
                    {trimmed.slice(3)}
                  </li>
                )
              }

              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote
                    key={index}
                    className="border-claw-500 text-muted-foreground my-6 border-l-4 pl-4 italic"
                  >
                    {trimmed.slice(2)}
                  </blockquote>
                )
              }

              if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                return (
                  <p key={index} className="my-4 font-bold">
                    {trimmed.slice(2, -2)}
                  </p>
                )
              }

              return (
                <p key={index} className="text-muted-foreground mb-4 leading-relaxed">
                  {trimmed}
                </p>
              )
            })}
          </div>

          {/* Navigation */}
          <nav className="flex items-center justify-between border-t pt-8">
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="text-muted-foreground hover:text-foreground group flex items-center gap-3 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider">Previous</div>
                  <div className="line-clamp-1 max-w-[200px] font-medium">{prevPost.title}</div>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {nextPost ? (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="text-muted-foreground hover:text-foreground group flex items-center gap-3 text-right transition-colors"
              >
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider">Next</div>
                  <div className="line-clamp-1 max-w-[200px] font-medium">{nextPost.title}</div>
                </div>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <div />
            )}
          </nav>
        </div>

        {/* Related Posts */}
        {recentPosts.length > 0 && (
          <section className="mx-auto mt-24 max-w-5xl">
            <h2 className="mb-8 text-center text-2xl font-bold">More from the Blog</h2>
            <div className="grid gap-8 md:grid-cols-2">
              {recentPosts.slice(0, 2).map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group block"
                >
                  <div className="bg-background hover:border-claw-500/30 rounded-2xl border p-6 transition-all hover:shadow-lg">
                    <span
                      className={cn(
                        'mb-4 inline-block rounded-full px-2.5 py-1 text-xs font-medium',
                        categoryColors[relatedPost.category].bg,
                        categoryColors[relatedPost.category].text
                      )}
                    >
                      {relatedPost.category.charAt(0).toUpperCase() + relatedPost.category.slice(1)}
                    </span>

                    <h3 className="group-hover:text-claw-500 mb-2 text-lg font-bold transition-colors">
                      {relatedPost.title}
                    </h3>

                    <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
                      {relatedPost.excerpt}
                    </p>

                    <div className="text-muted-foreground flex items-center gap-4 text-xs">
                      <span>
                        {new Date(relatedPost.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>{relatedPost.readTime}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
