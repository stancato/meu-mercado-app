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

          let currentUrl = targetUrl.trim().replace(/^http:\/\/(www\.nfce\.fazenda\.sp\.gov\.br)/i, 'https://$1')
          const cookieJar = new Map()
          let response = null

          for (let hop = 0; hop < 10; hop++) {
            const cookieHeader = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
            response = await fetch(currentUrl, {
              redirect: 'manual',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
              },
            })

            const rawCookies = typeof response.headers.getSetCookie === 'function'
              ? response.headers.getSetCookie()
              : [response.headers.get('set-cookie')].filter(Boolean)

            for (const cookieStr of rawCookies) {
              const firstPart = String(cookieStr).split(';')[0]
              const eqIdx = firstPart.indexOf('=')
              if (eqIdx > 0) {
                cookieJar.set(firstPart.slice(0, eqIdx).trim(), firstPart.slice(eqIdx + 1).trim())
              }
            }

            if ([301, 302, 303, 307, 308].includes(response.status)) {
              const location = response.headers.get('location')
              if (!location) break
              currentUrl = new URL(location, currentUrl).toString()
              continue
            }
            break
          }

          const contentType = response.headers.get('content-type') || ''
          const buffer = await response.arrayBuffer()
          const isLatin1 = /iso-8859-1|windows-1252|latin1/i.test(contentType)
          const html = new TextDecoder(isLatin1 ? 'windows-1252' : 'utf-8').decode(buffer)

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
