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

function nfceProxyPlugin() {
  return {
    name: 'nfce-proxy-plugin',
    configureServer(server) {
      server.middlewares.use('/api/proxy-nfce', async (req, res) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost')
          const targetUrl = urlObj.searchParams.get('url')
          if (!targetUrl) {
            res.statusCode = 400
            res.end('Missing url parameter')
            return
          }

          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          })

          const html = await response.text()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.statusCode = response.status
          res.end(html)
        } catch (err) {
          res.statusCode = 500
          res.end(err.message || 'Error fetching NFC-e')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionedServiceWorker(), nfceProxyPlugin()],
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
