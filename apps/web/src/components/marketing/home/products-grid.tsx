'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { products, getProductColors } from '@/lib/products'
import { cn } from '@/lib/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

export function ProductsGrid() {
  return (
    <section className="bg-muted/30 py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Complete Safety Suite</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Five specialized products working together to protect every aspect of your AI system,
            from memory integrity to physical safety.
          </p>
        </motion.div>

        {/* Products Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {products.map((product, index) => {
            const colors = getProductColors(product.color)
            const Icon = product.icon

            return (
              <motion.div
                key={product.slug}
                variants={itemVariants}
                className={cn(index === 0 && 'lg:col-span-2 lg:row-span-2')}
              >
                <Link
                  href={`/products/${product.slug}`}
                  className={cn(
                    'bg-background group block h-full rounded-2xl border p-6 lg:p-8',
                    'transition-all duration-300 hover:border-transparent hover:shadow-lg',
                    'hover:shadow-claw-500/5',
                    index === 0 && 'lg:flex lg:flex-col'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl',
                      colors.bg,
                      colors.border,
                      'border'
                    )}
                  >
                    <Icon className={cn('h-6 w-6', colors.text)} />
                  </div>

                  {/* Content */}
                  <div className={cn(index === 0 && 'lg:flex-1')}>
                    <h3 className="group-hover:text-claw-500 mb-2 text-xl font-semibold transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-muted-foreground mb-4">{product.tagline}</p>

                    {/* Extended description for featured card */}
                    {index === 0 && (
                      <p className="text-muted-foreground mb-6 hidden text-sm lg:block">
                        {product.description.split('\n')[0]}
                      </p>
                    )}

                    {/* Features preview */}
                    {index === 0 && (
                      <div className="mb-6 hidden lg:block">
                        <ul className="space-y-2">
                          {product.features.slice(0, 3).map((feature) => (
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
                      </div>
                    )}
                  </div>

                  {/* Link */}
                  <div className="text-claw-600 dark:text-claw-400 flex items-center gap-2 text-sm font-medium">
                    Learn more
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <Link
            href="/products"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            View all products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
