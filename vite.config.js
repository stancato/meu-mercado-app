import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

function versionedServiceWorker() {
  const buildVersion = new Date().toISOString()

  return {
    name: 'versioned-service-worker',
    apply: 'build',
    generateBundle() {
      const template = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')
      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: template.replaceAll('__BUILD_VERSION__', buildVersion),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionedServiceWorker()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'firebase-vendor'
          if (id.includes('@mui') || id.includes('@emotion')) return 'ui-vendor'
          if (id.includes('react')) return 'react-vendor'
        },
      },
    },
  },
})
