import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['src/__tests__/smoke/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'src/lib/prisma/index.ts'],
      thresholds: {
        lines: 50,
        branches: 40,
      },
    },
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
