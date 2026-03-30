'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { TypewriterTextProps } from './types'

/**
 * TypewriterText - Animated text that types character by character
 *
 * Creates a realistic typing effect with configurable speed and optional cursor.
 * Commonly used in demo chat interfaces to simulate user or agent typing.
 *
 * @example
 * ```tsx
 * <TypewriterText
 *   text="Hello, world!"
 *   speed={25}
 *   onComplete={() => console.log('Done typing')}
 * />
 * ```
 */
export function TypewriterText({
  text,
  speed = 25,
  onComplete,
  cursor = true,
  className,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true)

  // Store onComplete in a ref to avoid re-running effect when it changes
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
    setIsComplete(false)
  }, [text])

  // Typing animation effect
  useEffect(() => {
    if (currentIndex >= text.length) {
      if (!isComplete) {
        setIsComplete(true)
        onCompleteRef.current?.()
      }
      return
    }

    const timeout = setTimeout(() => {
      if (isMounted.current) {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }
    }, speed)

    return () => clearTimeout(timeout)
  }, [currentIndex, text, speed, isComplete])

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {displayedText}
      {cursor && !isComplete && (
        <span className="animate-pulse" aria-hidden="true">
          |
        </span>
      )}
    </span>
  )
}

/**
 * Hook version of TypewriterText for more control
 *
 * @example
 * ```tsx
 * const { displayedText, isComplete, reset } = useTypewriter({
 *   text: "Hello!",
 *   speed: 30,
 *   autoStart: true,
 * })
 * ```
 */
export function useTypewriter({
  text,
  speed = 25,
  autoStart = true,
  onComplete,
}: {
  text: string
  speed?: number
  autoStart?: boolean
  onComplete?: () => void
}) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(autoStart)
  const [isComplete, setIsComplete] = useState(false)

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const reset = useCallback(() => {
    setDisplayedText('')
    setCurrentIndex(0)
    setIsComplete(false)
    setIsTyping(false)
  }, [])

  const start = useCallback(() => {
    setIsTyping(true)
  }, [])

  const pause = useCallback(() => {
    setIsTyping(false)
  }, [])

  // Reset when text changes
  useEffect(() => {
    reset()
    if (autoStart) {
      setIsTyping(true)
    }
  }, [text, autoStart, reset])

  // Typing animation
  useEffect(() => {
    if (!isTyping || currentIndex >= text.length) {
      if (currentIndex >= text.length && !isComplete) {
        setIsComplete(true)
        setIsTyping(false)
        onCompleteRef.current?.()
      }
      return
    }

    const timeout = setTimeout(() => {
      setDisplayedText((prev) => prev + text[currentIndex])
      setCurrentIndex((prev) => prev + 1)
    }, speed)

    return () => clearTimeout(timeout)
  }, [isTyping, currentIndex, text, speed, isComplete])

  return {
    displayedText,
    isTyping,
    isComplete,
    progress: text.length > 0 ? currentIndex / text.length : 0,
    reset,
    start,
    pause,
  }
}

export default TypewriterText
