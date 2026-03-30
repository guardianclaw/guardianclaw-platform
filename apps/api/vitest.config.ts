import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/**/*.test.ts',
        'src/index.ts', // Entry point, covered by integration tests
        'src/scheduled.ts', // Cron entry point, covered by integration tests
        'src/services/code-generator/**', // New feature, needs more tests
        'src/services/social-connectors/**', // New feature, needs more tests
      ],
      thresholds: {
        statements: 70,
        branches: 75,
        functions: 70,
        lines: 70,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
