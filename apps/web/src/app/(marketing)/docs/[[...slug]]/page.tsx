import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Book } from 'lucide-react'
import { getAllDocSlugs, getDocNavigation } from '@/lib/docs'
import { getDocPageServer } from '@/lib/docs/server'
import { DocsSidebar } from '@/components/docs/sidebar'
import { cn } from '@/lib/utils'

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
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }} />
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

// Simple markdown renderer (in production, use a proper markdown library)
function renderMarkdown(content: string): string {
  // Step 1: Extract code blocks and replace with placeholders to protect their content
  const codeBlocks: string[] = []
  let result = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
    codeBlocks.push(
      `<pre class="bg-gray-950 rounded-xl p-4 overflow-x-auto my-4"><code class="text-sm font-mono language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`
    )
    return placeholder
  })

  // Step 2: Process tables as complete blocks
  const tableRegex = /(\|[^\n]+\|\n)+/g
  result = result.replace(tableRegex, (tableBlock) => {
    const lines = tableBlock.trim().split('\n')
    if (lines.length < 2) return tableBlock

    const rows: string[] = []
    let isHeader = true

    for (const line of lines) {
      // Skip separator line (|---|---|)
      if (line.match(/^\|[\s-:|]+\|$/)) {
        isHeader = false
        continue
      }

      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
      const tag = isHeader ? 'th' : 'td'
      const cellClass = isHeader
        ? 'border border-border px-4 py-2 text-left font-semibold bg-muted/50'
        : 'border border-border px-4 py-2 text-left'
      rows.push(
        `<tr>${cells.map((c) => `<${tag} class="${cellClass}">${c}</${tag}>`).join('')}</tr>`
      )

      if (isHeader) isHeader = false
    }

    return `<div class="overflow-x-auto my-6"><table class="w-full border-collapse border border-border rounded-lg">${rows.join('')}</table></div>`
  })

  // Step 3: Apply markdown transformations (safe now that code blocks are protected)
  result = result
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-10 mb-4">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mb-6">$1</h1>')
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">$1</code>'
    )
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-claw-600 dark:text-claw-400 hover:underline">$1</a>'
    )
    // Lists - wrap consecutive items
    .replace(/(^- .*$\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split('\n')
        .map((line) => `<li class="ml-4">${line.replace(/^- /, '')}</li>`)
        .join('')
      return `<ul class="list-disc my-4 space-y-1">${items}</ul>`
    })
    // Blockquotes
    .replace(
      /^> (.*$)/gm,
      '<blockquote class="border-l-4 border-claw-500 pl-4 italic text-muted-foreground my-4">$1</blockquote>'
    )
    // Paragraphs - only wrap lines that aren't already HTML or placeholders
    .replace(/^(?!<|__CODE_BLOCK)([^\n]+)$/gm, (match) => {
      if (match.trim().length === 0) return ''
      return `<p class="my-4">${match}</p>`
    })
    // Clean up extra paragraph tags around block elements
    .replace(/<p class="my-4">(<(?:h[1-6]|pre|ul|ol|table|div|blockquote)[^>]*>)/g, '$1')
    .replace(/(<\/(?:h[1-6]|pre|ul|ol|table|div|blockquote)>)<\/p>/g, '$1')

  // Step 4: Restore code blocks
  codeBlocks.forEach((block, i) => {
    result = result.replace(`__CODE_BLOCK_${i}__`, block)
  })

  return result
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
