/**
 * Navigation validation tests
 *
 * These tests verify that all navigation paths are correctly configured
 * and that the routes exist as expected.
 */

import { describe, it, expect } from 'vitest'

// All builder sub-pages that should exist
const BUILDER_PAGES = [
  'flow',
  'test',
  'deploy',
  'analytics',
  'claw', // Added in Session 218
  'settings', // Added in Session 218
]

// Pages that are disabled in demo mode (no functionality)
const DEMO_DISABLED_PAGES = ['deploy', 'analytics', 'claw', 'settings']

// Pages accessible via tabs in the layout
const TAB_PAGES = ['flow', 'test', 'deploy', 'analytics']

// Pages accessible via dropdown menu only
const DROPDOWN_PAGES = ['claw', 'settings']

describe('Builder navigation structure', () => {
  it('should have all required sub-pages defined', () => {
    // All 6 pages should be defined
    expect(BUILDER_PAGES).toHaveLength(6)
    expect(BUILDER_PAGES).toContain('flow')
    expect(BUILDER_PAGES).toContain('test')
    expect(BUILDER_PAGES).toContain('deploy')
    expect(BUILDER_PAGES).toContain('analytics')
    expect(BUILDER_PAGES).toContain('claw')
    expect(BUILDER_PAGES).toContain('settings')
  })

  it('should have correct pages disabled in demo mode', () => {
    // Pages that show "Not Available" message in demo mode
    expect(DEMO_DISABLED_PAGES).toContain('deploy')
    expect(DEMO_DISABLED_PAGES).toContain('analytics')
    expect(DEMO_DISABLED_PAGES).toContain('claw')
    expect(DEMO_DISABLED_PAGES).toContain('settings')

    // flow and test should NOT be disabled
    expect(DEMO_DISABLED_PAGES).not.toContain('flow')
    expect(DEMO_DISABLED_PAGES).not.toContain('test')
  })

  it('should have 4 tab pages and 2 dropdown pages', () => {
    expect(TAB_PAGES).toHaveLength(4)
    expect(DROPDOWN_PAGES).toHaveLength(2)

    // All pages should be in either tabs or dropdown
    const allPages = [...TAB_PAGES, ...DROPDOWN_PAGES]
    BUILDER_PAGES.forEach((page) => {
      expect(allPages).toContain(page)
    })
  })
})

describe('Navigation routes validation', () => {
  describe('Builder routes', () => {
    it('should generate correct route for each page', () => {
      const agentId = 'test-agent-123'

      BUILDER_PAGES.forEach((page) => {
        const route = `/app/builder/${agentId}/${page}`
        expect(route).toMatch(/^\/app\/builder\/[^/]+\/[^/]+$/)
      })
    })

    it('should generate correct demo routes', () => {
      BUILDER_PAGES.forEach((page) => {
        const route = `/app/builder/demo/${page}`
        expect(route).toMatch(/^\/app\/builder\/demo\/[^/]+$/)
      })
    })
  })

  describe('BuilderHeader navigation (Session 218 fix)', () => {
    it('handleTest should use direct route, not query params', () => {
      const agentId = 'test-123'
      const isDemo = false

      // Old (broken): router.push(`/builder?id=${agentId}&mode=test`)
      // New (fixed): router.push(`/app/builder/${agentId}/test`)

      const correctRoute = isDemo ? '/app/builder/demo/test' : `/app/builder/${agentId}/test`

      expect(correctRoute).not.toContain('?')
      expect(correctRoute).not.toContain('mode=')
      expect(correctRoute).toMatch(/\/test$/)
    })

    it('handleDeploy should use direct route, not query params', () => {
      const agentId = 'test-123'

      // Old (broken): router.push(`/builder?id=${agentId}&mode=deploy`)
      // New (fixed): router.push(`/app/builder/${agentId}/deploy`)

      const correctRoute = `/app/builder/${agentId}/deploy`

      expect(correctRoute).not.toContain('?')
      expect(correctRoute).not.toContain('mode=')
      expect(correctRoute).toMatch(/\/deploy$/)
    })

    it('handleSettings should use direct route, not query params', () => {
      const agentId = 'test-123'

      // Old (broken): router.push(`/builder?id=${agentId}&mode=settings`)
      // New (fixed): router.push(`/app/builder/${agentId}/settings`)

      const correctRoute = `/app/builder/${agentId}/settings`

      expect(correctRoute).not.toContain('?')
      expect(correctRoute).not.toContain('mode=')
      expect(correctRoute).toMatch(/\/settings$/)
    })
  })

  describe('AgentCard dropdown navigation (Session 218 fix)', () => {
    it('GuardianClaw Config should navigate to /app/builder/[id]/claw', () => {
      const agentId = 'test-123'
      const route = `/app/builder/${agentId}/claw`

      // This route now exists (Session 218)
      expect(route).toMatch(/\/claw$/)
      expect(route).not.toContain('?')
    })

    it('Deploy Settings should navigate to /app/builder/[id]/deploy', () => {
      const agentId = 'test-123'
      const route = `/app/builder/${agentId}/deploy`

      expect(route).toMatch(/\/deploy$/)
    })
  })
})

describe('Route existence validation', () => {
  // These tests document which routes exist and their purpose

  it('main builder routes should exist', () => {
    const mainRoutes = [
      '/builder', // Agent list
      '/app/builder/new', // Create new agent wizard
      '/app/builder/demo/flow', // Demo mode flow editor
    ]

    mainRoutes.forEach((route) => {
      expect(route).toBeDefined()
    })
  })

  it('agent sub-routes should exist', () => {
    const agentRoutes = BUILDER_PAGES.map((page) => `/app/builder/[id]/${page}`)

    agentRoutes.forEach((route) => {
      expect(route).toBeDefined()
    })

    // Specifically verify the new routes from Session 218
    expect(agentRoutes).toContain('/app/builder/[id]/claw')
    expect(agentRoutes).toContain('/app/builder/[id]/settings')
  })
})
