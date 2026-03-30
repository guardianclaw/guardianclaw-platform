/**
 * useScrollSpy - Custom hook for tracking active section during scroll
 *
 * Uses a scroll listener with position-based detection for stable,
 * flicker-free active section tracking.
 *
 * Design principles:
 * - The scroll listener is set up ONCE and never torn down/recreated during the
 *   lifetime of the component. This is achieved by storing sectionIds and offset
 *   in refs, so changes to those values never cause the effect to re-run.
 * - Active section = last section whose top edge has crossed the offset threshold.
 *   This is deterministic: for a given scroll position there is exactly one answer.
 * - rAF throttling limits state updates to one per animation frame (~60/s).
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { UseScrollSpyReturn } from './types'

interface UseScrollSpyOptions {
  /** Section IDs to observe, in document order */
  sectionIds: string[]
  /** Distance from viewport top that counts as "reached" (px) */
  offset?: number
  /** Unused — kept for API compatibility */
  rootMargin?: string
}

export function useScrollSpy({
  sectionIds,
  offset = 120,
}: UseScrollSpyOptions): UseScrollSpyReturn {
  // Store sectionIds and offset in refs so the scroll listener never needs to
  // be re-created when the caller passes a new array reference or changes offset.
  const sectionIdsRef = useRef<string[]>(sectionIds)
  const offsetRef = useRef<number>(offset)
  sectionIdsRef.current = sectionIds
  offsetRef.current = offset

  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '')
  const rafRef = useRef<number | null>(null)

  // Reads from refs — no closure over props, always sees latest values
  const getActiveId = useCallback((): string => {
    const ids = sectionIdsRef.current
    const threshold = window.scrollY + offsetRef.current + 1
    let current = ids[0] ?? ''
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY
        if (top <= threshold) current = id
      }
    }
    return current
  }, []) // stable — no deps needed because it reads from refs

  // Set up the scroll listener exactly once
  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        setActiveId(getActiveId())
        rafRef.current = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Compute initial active section synchronously
    setActiveId(getActiveId())

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [getActiveId]) // getActiveId is stable, so this effect runs exactly once

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return

    const top = el.getBoundingClientRect().top + window.scrollY - offsetRef.current
    window.scrollTo({ top, behavior: 'smooth' })

    // Update immediately so the sidebar reflects the target before scroll finishes
    setActiveId(id)
    window.history.pushState(null, '', `#${id}`)
  }, []) // stable — reads offset from ref

  // Honour URL hash on initial load
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (hash && sectionIdsRef.current.includes(hash)) {
      // Small delay to let the DOM finish rendering before computing positions
      const t = setTimeout(() => scrollTo(hash), 150)
      return () => clearTimeout(t)
    }
  }, [scrollTo]) // scrollTo is stable, this runs once on mount

  return { activeId, scrollTo }
}

export default useScrollSpy
