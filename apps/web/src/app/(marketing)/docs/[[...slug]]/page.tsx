import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Book } from 'lucide-react'
import { getAllDocSlugs, getDocNavigation } from '@/lib/docs'
import { getDocPageServer } from '@/lib/docs/server'
import { DocsSidebar } from '@/components/docs/sidebar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import type { Components } from 'react-markdown'

// Blocked URI schemes that could execute code
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i

// Custom components for react-markdown with safe link handling
const markdownComponents: Components = {
  a: ({ href, children, ...props }) => {
    if (href && DANGEROUS_PROTOCOLS.test(href)) {
      return <span>{children}</span>
    }

    const isExternal = href?.startsWith('http://') || href?.startsWith('https://')

    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      )
    }

    return (
      <Link href={href || '#'} {...props}>
        {children}
      </Link>
    )
  },
}

interface PageProps {
  params: Promise<{ slug?: string[] }>
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs()
  return [
    { slug: undefined }, // /docs
    ...slugs.map((slug) => ({ slug: slug.split('/') })),
  ]
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const pageSlug = slug?.join('/') || 'introduction'
  const page = getDocPageServer(pageSlug)

  if (!page) {
    return { title: 'Documentation | GuardianClaw' }
  }

  return {
    title: `${page.title} | GuardianClaw Docs`,
    description: page.description,
  }
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params
  const pageSlug = slug?.join('/') || 'introduction'
  const page = getDocPageServer(pageSlug)

  // If no content found, show the docs index
  if (!page) {
    if (pageSlug !== 'introduction' && slug && slug.length > 0) {
      notFound()
    }
    // Show docs landing page
    return (
      <DocsLayout>
        <DocsIndex />
      </DocsLayout>
    )
  }

  // Find prev/next pages for navigation
  const allSlugs = getAllDocSlugs()
  const currentIndex = allSlugs.indexOf(pageSlug)
  const prevSlug = currentIndex > 0 ? allSlugs[currentIndex - 1] : null
  const nextSlug = currentIndex < allSlugs.length - 1 ? allSlugs[currentIndex + 1] : null

  const navigation = getDocNavigation()
  const prevPage = prevSlug
    ? navigation.flatMap((s) => s.items).find((i) => i.slug === prevSlug)
    : null
  const nextPage = nextSlug
    ? navigation.flatMap((s) => s.items).find((i) => i.slug === nextSlug)
    : null

  return (
    <DocsLayout>
      <article className="min-w-0 max-w-3xl flex-1">
        {/* Breadcrumb */}
        <div className="text-muted-foreground mb-8 flex items-center gap-2 text-sm">
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Docs
          </Link>
          <span>/</span>
          <span className="text-foreground">{page.title}</span>
        </div>

        {/* Content */}
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeSlug]}
            components={markdownComponents}
          >
            {page.content}
          </ReactMarkdown>
        </div>

        {/* Navigation */}
        <div className="mt-16 flex items-center justify-between border-t pt-8">
          {prevPage ? (
            <Link
              href={`/docs/${prevPage.slug}`}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider">Previous</div>
                <div className="font-medium">{prevPage.title}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextPage ? (
            <Link
              href={`/docs/${nextPage.slug}`}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-3 text-right transition-colors"
            >
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider">Next</div>
                <div className="font-medium">{nextPage.title}</div>
              </div>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </article>
    </DocsLayout>
  )
}

function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-24 lg:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-12">
          <div className="hidden lg:block">
            <DocsSidebar />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function DocsIndex() {
  const navigation = getDocNavigation()

  return (
    <div className="flex-1">
      <div className="mb-12">
        <div className="bg-claw-500/10 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl">
          <Book className="text-claw-500 h-8 w-8" />
        </div>
        <h1 className="mb-4 text-4xl font-bold">Documentation</h1>
        <p className="text-muted-foreground max-w-2xl text-xl">
          Learn how to integrate GuardianClaw into your AI systems with our comprehensive guides and
          API reference.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {navigation.map((section) => (
          <div key={section.title} className="bg-background rounded-xl border p-6">
            <h2 className="mb-4 font-semibold">{section.title}</h2>
            <ul className="space-y-2">
              {section.items.slice(0, 4).map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    className="text-muted-foreground hover:text-foreground block text-sm transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
