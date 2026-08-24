import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    // Node por padrao (mais rapido, sem surpresas de WebCrypto/jsdom); os
    // testes de componente que precisam de DOM declaram
    // `// @vitest-environment jsdom` no topo do proprio arquivo.
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
})
