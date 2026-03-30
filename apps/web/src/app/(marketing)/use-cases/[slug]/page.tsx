import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from 'lucide-react'
import { useCases, getUseCase, getUseCaseColors } from '@/lib/use-cases'
import { products, getProduct } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return useCases.map((useCase) => ({
    slug: useCase.slug,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const useCase = getUseCase(slug)

  if (!useCase) {
    return { title: 'Use Case Not Found | GuardianClaw' }
  }

  return {
    title: `${useCase.name} | GuardianClaw Use Cases`,
    description: useCase.tagline,
  }
}

export default async function UseCasePage({ params }: PageProps) {
  const { slug } = await params
  const useCase = getUseCase(slug)

  if (!useCase) {
    notFound()
  }

  const colors = getUseCaseColors(useCase.color)
  const Icon = useCase.icon
  const relatedProducts = useCase.products.map((slug) => getProduct(slug)).filter(Boolean)

  // Find next/prev use cases for navigation
  const currentIndex = useCases.findIndex((uc) => uc.slug === slug)
  const prevUseCase = currentIndex > 0 ? useCases[currentIndex - 1] : null
  const nextUseCase = currentIndex < useCases.length - 1 ? useCases[currentIndex + 1] : null

  return (
    <div className="py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/#use-cases"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Use Cases
        </Link>

        {/* Hero */}
        <div className="mb-16 max-w-4xl">
          {/* Icon */}
          <div
            className={cn(
              'mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl',
              colors.bg
            )}
          >
            <Icon className={cn('h-10 w-10', colors.text)} />
          </div>

          {/* Title */}
          <h1 className="mb-4 text-4xl font-bold sm:text-5xl">{useCase.name}</h1>
          <p className="text-muted-foreground text-xl">{useCase.tagline}</p>
        </div>

        {/* Challenge Section */}
        <div className="mb-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
            <div className="mb-6 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h2 className="text-2xl font-bold">{useCase.challenge.title}</h2>
            </div>
            <p className="text-muted-foreground mb-6">{useCase.challenge.description}</p>
            <ul className="space-y-3">
              {useCase.challenge.problems.map((problem) => (
                <li key={problem} className="flex items-start gap-3">
                  <span className="mt-1 text-red-500">•</span>
                  <span className="text-muted-foreground">{problem}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-claw-500/5 border-claw-500/20 rounded-2xl border p-8">
            <div className="mb-6 flex items-center gap-3">
              <Check className="text-claw-500 h-6 w-6" />
              <h2 className="text-2xl font-bold">{useCase.solution.title}</h2>
            </div>
            <p className="text-muted-foreground mb-6">{useCase.solution.description}</p>
            <ul className="space-y-3">
              {useCase.solution.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <Check className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mb-16">
            <h2 className="mb-8 text-center text-2xl font-bold">Recommended Products</h2>
            <div
              className={cn(
                'mx-auto grid max-w-3xl gap-6',
                relatedProducts.length > 1 ? 'sm:grid-cols-2' : 'max-w-md'
              )}
            >
              {relatedProducts.map((product) => {
                if (!product) return null
                const ProductIcon = product.icon
                return (
                  <Link
                    key={product.slug}
                    href={`/products/${product.slug}`}
                    className="bg-background hover:border-claw-500/30 group flex items-start gap-4 rounded-xl border p-6 transition-colors"
                  >
                    <div className="bg-claw-500/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl">
                      <ProductIcon className="text-claw-500 h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="group-hover:text-claw-500 font-semibold transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-muted-foreground text-sm">{product.tagline}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mb-16 text-center">
          <Button size="lg" asChild>
            <Link href="/app/agents">
              Get Started with GuardianClaw
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t pt-8">
          {prevUseCase ? (
            <Link
              href={`/use-cases/${prevUseCase.slug}`}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider">Previous</div>
                <div className="font-medium">{prevUseCase.name}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextUseCase ? (
            <Link
              href={`/use-cases/${nextUseCase.slug}`}
              className="text-muted-foreground hover:text-foreground group flex items-center gap-3 text-right transition-colors"
            >
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider">Next</div>
                <div className="font-medium">{nextUseCase.name}</div>
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
