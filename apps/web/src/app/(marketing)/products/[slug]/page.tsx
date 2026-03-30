import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Code, ExternalLink } from 'lucide-react'
import { products, getProduct, getProductColors } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = getProduct(slug)

  if (!product) {
    return { title: 'Product Not Found | GuardianClaw' }
  }

  return {
    title: `${product.name} | GuardianClaw Products`,
    description: product.description.split('\n')[0],
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const product = getProduct(slug)

  if (!product) {
    notFound()
  }

  const colors = getProductColors(product.color)
  const Icon = product.icon

  // Find next/prev products for navigation
  const currentIndex = products.findIndex((p) => p.slug === slug)
  const prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null
  const nextProduct = currentIndex < products.length - 1 ? products[currentIndex + 1] : null

  return (
    <div className="py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/products"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Products
        </Link>

        {/* Hero */}
        <div className="mb-16 grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            {/* Icon */}
            <div
              className={cn(
                'mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl',
                colors.bg,
                colors.border,
                'border'
              )}
            >
              <Icon className={cn('h-10 w-10', colors.text)} />
            </div>

            {/* Title */}
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl">{product.name}</h1>
            <p className="text-muted-foreground mb-6 text-xl">{product.tagline}</p>

            {/* Description */}
            <div className="prose prose-gray dark:prose-invert mb-8 max-w-none">
              {product.description.split('\n').map((paragraph, i) => (
                <p key={i} className="text-muted-foreground">
                  {paragraph.trim()}
                </p>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild>
                <Link href="/app/builder">
                  Try {product.name}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={`/docs/products/${product.slug}`}>
                  View Documentation
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Code Example */}
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-xl border bg-gray-950">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400">{product.codeExample.language}</span>
                </div>
              </div>

              {/* Code */}
              <pre className="overflow-x-auto p-6">
                <code className="whitespace-pre font-mono text-sm text-gray-300">
                  {product.codeExample.code}
                </code>
              </pre>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="mb-8 text-2xl font-bold">Key Features</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {product.features.map((feature) => (
              <div
                key={feature}
                className="bg-background flex items-start gap-3 rounded-xl border p-4"
              >
                <div
                  className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                    colors.bg
                  )}
                >
                  <Check className={cn('h-4 w-4', colors.text)} />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mb-16">
          <h2 className="mb-8 text-2xl font-bold">Best For</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {product.useCases.map((useCase) => (
              <div key={useCase} className="bg-muted/30 rounded-xl border p-6">
                <p className="font-medium">{useCase}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t pt-8">
          {prevProduct ? (
            <Link
              href={`/products/${prevProduct.slug}`}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider">Previous</div>
                <div className="font-medium">{prevProduct.name}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextProduct ? (
            <Link
              href={`/products/${nextProduct.slug}`}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-3 text-right transition-colors"
            >
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider">Next</div>
                <div className="font-medium">{nextProduct.name}</div>
              </div>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  )
}
