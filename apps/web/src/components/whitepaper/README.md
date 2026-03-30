# Whitepaper Components

Single-page technical whitepaper with animated diagrams and interactive navigation.

## Overview

The whitepaper system provides a unified, scrollable format for the GuardianClaw technical documentation with:

- **15 sections** covering all aspects of the GuardianClaw platform
- **9 animated diagrams** visualizing architecture and processes
- **Sticky table of contents** for easy navigation
- **Print-friendly styles** for PDF generation
- **Full accessibility** with ARIA landmarks and skip links

## Architecture

```
whitepaper/
├── index.ts                 # Public exports (barrel file)
├── types.ts                 # TypeScript interfaces
├── use-scroll-spy.ts        # Scroll position tracking hook
│
├── Layout Components
│   ├── WhitepaperLayout.tsx # Main two-column layout
│   ├── WhitepaperNav.tsx    # Table of contents navigation
│   ├── WhitepaperHeader.tsx # Document header
│   └── WhitepaperSection.tsx # Section wrapper + dividers
│
├── shared/                  # Reusable UI components
│   ├── DataTable.tsx        # Responsive tables
│   ├── CodeBlock.tsx        # Syntax-highlighted code
│   ├── QuoteBox.tsx         # Styled quotes
│   ├── InfoBox.tsx          # Collapsible info boxes
│   ├── StatCard.tsx         # Metric displays
│   └── ExtLink.tsx          # External links
│
├── diagrams/                # Animated visualizations
│   ├── FourLayerArchitecture.tsx  # L1-L4 validation flow
│   ├── CLAWProtocol.tsx           # 4-gate validation
│   ├── PriorityHierarchy.tsx      # Priority levels
│   ├── MemoryShieldFlow.tsx       # Memory validation
│   ├── BenchmarkResults.tsx       # Performance data
│   ├── MarketComparison.tsx       # Competitor analysis
│   ├── IntegrationGrid.tsx        # 22 ecosystem items
│   ├── InputValidatorTree.tsx     # L1 detector tree
│   └── LazyDiagrams.tsx           # Dynamic imports
│
└── whitepaper-content.tsx   # Section content (15 sections)
```

## Usage

### Basic Usage

```tsx
import {
  WhitepaperLayout,
  WhitepaperHeader,
  WhitepaperSection,
  sectionContent,
} from '@/components/whitepaper'

export default function WhitepaperPage() {
  return (
    <WhitepaperLayout navItems={navItems} title="Whitepaper">
      <WhitepaperHeader title="GCLAW" subtitle="Decision Firewall" />
      {sections.map((section) => (
        <WhitepaperSection key={section.id} config={section}>
          {sectionContent[section.id]}
        </WhitepaperSection>
      ))}
    </WhitepaperLayout>
  )
}
```

### Adding a New Section

1. **Define the section config** in `page.tsx`:

```tsx
const sections: WhitepaperSectionConfig[] = [
  // ... existing sections
  {
    id: 'new-section',
    title: 'New Section',
    subtitle: 'Description of the section',
    icon: SomeIcon,
    order: 16,
  },
]
```

2. **Add navigation entry** in `page.tsx`:

```tsx
const navItems: WhitepaperNavItem[] = [
  // ... existing items
  { id: 'new-section', title: 'New Section', level: 1, icon: SomeIcon },
]
```

3. **Create content** in `whitepaper-content.tsx`:

```tsx
function NewSectionContent() {
  return (
    <>
      <p className="mb-6 text-lg leading-relaxed text-zinc-300">Introduction paragraph...</p>
      {/* Add more content */}
    </>
  )
}

export const sectionContent: Record<string, React.FC> = {
  // ... existing content
  'new-section': NewSectionContent,
}
```

### Creating a New Diagram

1. **Create the component** in `diagrams/`:

```tsx
// diagrams/NewDiagram.tsx
'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface NewDiagramProps {
  animated?: boolean
  className?: string
}

function NewDiagramInner({ animated = true, className }: NewDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Intersection Observer for scroll-triggered animation
  useEffect(() => {
    if (!animated) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [animated])

  return (
    <div
      ref={containerRef}
      className={cn('rounded-xl border border-zinc-800 bg-zinc-900/50 p-6', className)}
      role="figure"
      aria-label="New Diagram"
    >
      {/* Diagram content */}
    </div>
  )
}

export const NewDiagram = memo(NewDiagramInner)
```

2. **Export from index** in `diagrams/index.ts`:

```tsx
export { NewDiagram } from './NewDiagram'
export type { NewDiagramProps } from './NewDiagram'
```

3. **Add lazy version** in `diagrams/LazyDiagrams.tsx`:

```tsx
const NewDiagramLazy = dynamic(() => import('./NewDiagram').then((mod) => mod.NewDiagram), {
  loading: () => <DiagramLoading height="400px" label="Loading diagram" />,
  ssr: false,
})

export { NewDiagramLazy }
```

## Patterns Used

### Animation Patterns

- **IntersectionObserver** for scroll-triggered animations
- **Framer Motion** for smooth transitions
- **Staggered delays** for sequential reveals
- **`ssr: false`** for client-only animated components

### Accessibility Patterns

- **Skip links** for keyboard navigation
- **ARIA landmarks** (`main`, `navigation`, `complementary`)
- **`aria-live`** for dynamic content announcements
- **`aria-expanded`** for collapsible sections
- **`role="figure"`** for diagrams with `aria-label`

### Performance Patterns

- **`memo()`** for component memoization
- **`useMemo()`** for expensive computations
- **`dynamic()`** for code splitting
- **Lazy loading** with `useNearViewport` hook

### Print Patterns

- **`@media print`** styles in `globals.css`
- **`.no-print`** class for elements to hide
- **`.page-break-before/after`** for manual breaks
- **`.diagram-container`** for print-friendly diagrams

## Component Reference

### Layout Components

| Component           | Description                              |
| ------------------- | ---------------------------------------- |
| `WhitepaperLayout`  | Two-column layout with sticky TOC        |
| `WhitepaperNav`     | Collapsible navigation with active state |
| `WhitepaperHeader`  | Document title and metadata              |
| `WhitepaperSection` | Section wrapper with ID anchor           |
| `WhitepaperDivider` | Visual section separator                 |

### Shared UI Components

| Component   | Props                                     | Description              |
| ----------- | ----------------------------------------- | ------------------------ |
| `DataTable` | `columns`, `data`, `striped`, `hoverable` | Responsive tables        |
| `CodeBlock` | `code`, `language`, `showLineNumbers`     | Syntax highlighting      |
| `QuoteBox`  | `children`, `variant`, `attribution`      | Styled blockquotes       |
| `InfoBox`   | `title`, `variant`, `collapsible`         | Info/warning boxes       |
| `StatCard`  | `value`, `label`, `variant`, `trend`      | Metric displays          |
| `ExtLink`   | `href`, `children`                        | External links with icon |

### Diagram Components

| Component               | Description                              |
| ----------------------- | ---------------------------------------- |
| `FourLayerArchitecture` | L1-L4 validation flow with scenarios     |
| `CLAWProtocol`          | Credibility-Limits-Avoidance-Worth gates |
| `PriorityHierarchy`     | Priority levels visualization            |
| `MemoryShieldFlow`      | Memory Shield v2 validation              |
| `BenchmarkResults`      | Performance benchmark table              |
| `MarketComparison`      | Competitor comparison matrix             |
| `IntegrationGrid`       | 22 items in 8 categories                 |
| `InputValidatorTree`    | L1 detector tree with weights            |

### Lazy Components

All diagram components have lazy-loaded versions:

```tsx
import {
  FourLayerArchitectureLazy,
  CLAWProtocolLazy,
  // ... etc
} from '@/components/whitepaper'
```

## Styling

The whitepaper uses Tailwind CSS with the project's design tokens:

- **Colors**: `claw-*` (green brand), `zinc-*` (neutral)
- **Dark theme**: `bg-zinc-900`, `text-zinc-100`
- **Borders**: `border-zinc-800`
- **Accents**: `text-claw-400`, `bg-claw-500/10`

## Testing

Components can be tested with:

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Visual test (dev server)
npm run dev
# Then visit http://localhost:3000/whitepaper
```

## Files Reference

| File                     | Lines | Purpose               |
| ------------------------ | ----- | --------------------- |
| `types.ts`               | 115   | TypeScript interfaces |
| `use-scroll-spy.ts`      | 139   | Scroll tracking hook  |
| `WhitepaperLayout.tsx`   | 300   | Main layout           |
| `WhitepaperNav.tsx`      | 152   | Navigation            |
| `WhitepaperHeader.tsx`   | 173   | Header                |
| `WhitepaperSection.tsx`  | 161   | Section wrapper       |
| `whitepaper-content.tsx` | 1456  | Content (15 sections) |
| `index.ts`               | 117   | Exports               |
| `shared/*`               | 1005  | UI components (7)     |
| `diagrams/*`             | 6300+ | Diagrams (9) + lazy   |

**Total: ~10,000 lines**
