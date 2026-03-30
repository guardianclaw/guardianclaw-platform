import '@testing-library/jest-dom'
import { webcrypto } from 'node:crypto'

// Polyfill crypto.subtle for jsdom environment
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  })
}
