/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'
import { incidentsApi } from './server/incidents-api'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    incidentsApi({
      ...loadEnv(mode, process.cwd(), 'INCIDENT'),
      ...loadEnv(mode, process.cwd(), 'OPENAI'),
      ...loadEnv(mode, process.cwd(), 'OPENROUTER'),
      RELAY_VITE_MODE: mode,
    }),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // Правки выгрузки не должны делать full reload вкладки.
      ignored: ['**/data/**'],
    },
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    exclude: ['server/**'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
}))
