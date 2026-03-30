import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { products, getProductColors } from '@/lib/products'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Products | GuardianClaw',
  description:
    'Complete safety suite for AI agents. Memory Shield, Database Guard, Humanoid Safety, Fiduciary AI, and Transaction Simulator.',
}

export default function ProductsPage() {
  return (
    <div className="py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold sm:text-5xl">Complete Safety Suite</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Five specialized products working together to protect every aspect of your AI system,
            from memory integrity to physical safety.
          </p>
        </div>

        {/* Products Grid */}
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {products.map((product, index) => {
            const colors = getProductColors(product.color)
            const Icon = product.icon

            return (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className={cn(
                  'bg-background group block rounded-2xl border p-8',
                  'transition-all duration-300 hover:border-transparent hover:shadow-xl',
                  'hover:shadow-claw-500/5',
                  index === 0 && 'md:col-span-2'
                )}
              >
                <div
                  className={cn(
                    'flex gap-6',
                    index === 0 ? 'flex-col md:flex-row md:items-start' : 'flex-col'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'inline-flex flex-shrink-0 items-center justify-center rounded-xl',
                      index === 0 ? 'h-16 w-16' : 'h-14 w-14',
                      colors.bg,
                      colors.border,
                      'border'
                    )}
                  >
                    <Icon className={cn(index === 0 ? 'h-8 w-8' : 'h-7 w-7', colors.text)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h2
                      className={cn(
                        'group-hover:text-claw-500 mb-2 font-bold transition-colors',
                        index === 0 ? 'text-2xl' : 'text-xl'
                      )}
                    >
                      {product.name}
                    </h2>
                    <p className="text-muted-foreground mb-4">{product.tagline}</p>

                    {/* Description for featured */}
                    {index === 0 && (
                      <p className="text-muted-foreground mb-6 text-sm">
                        {product.description.split('\n')[0]}
                      </p>
                    )}

                    {/* Features */}
                    <ul
                      className={cn(
                        'mb-6 space-y-2',
                        index === 0 ? 'md:grid md:grid-cols-2 md:gap-x-8 md:space-y-0' : ''
                      )}
                    >
                      {product.features.slice(0, index === 0 ? 4 : 3).map((feature) => (
                        <li
                          key={feature}
                          className="text-muted-foreground flex items-center gap-2 text-sm"
                        >
                          <div
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              colors.text.replace('text-', 'bg-')
                            )}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Link */}
                    <div className="text-claw-600 dark:text-claw-400 flex items-center gap-2 text-sm font-medium">
                      Learn more
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            All products work together seamlessly in the GuardianClaw platform.
          </p>
          <Link
            href="/app/builder"
            className="bg-claw-600 hover:bg-claw-700 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-colors"
          >
            Start Building
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
