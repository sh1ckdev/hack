import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'server/production.ts',
    outDir: 'dist-server',
    target: 'node24',
  },
  ssr: {
    noExternal: true,
  },
})
