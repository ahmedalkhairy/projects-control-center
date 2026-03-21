import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'

// ─── Jira Proxy Plugin ────────────────────────────────────────────────────────
// Only used in browser dev mode (npm run dev without Electron).
// In Electron, Jira calls go through IPC → main process directly.
// ─────────────────────────────────────────────────────────────────────────────

function jiraProxyPlugin(): Plugin {
  return {
    name: 'jira-proxy',
    configureServer(server) {
      server.middlewares.use('/api/jira-proxy', (req, res) => {
        const jiraBaseUrl  = req.headers['x-jira-url']      as string | undefined
        const username     = req.headers['x-jira-username'] as string | undefined
        const apiToken     = req.headers['x-jira-token']    as string | undefined

        if (!jiraBaseUrl) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing x-jira-url header' }))
          return
        }

        const jiraPath = req.url || '/'

        let normalizedBase = jiraBaseUrl.trim()
        if (!/^https?:\/\//i.test(normalizedBase)) {
          normalizedBase = 'https://' + normalizedBase
        }

        let targetUrl: URL
        try {
          targetUrl = new URL(normalizedBase.replace(/\/$/, '') + jiraPath)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Invalid Jira server URL: "${jiraBaseUrl}"` }))
          return
        }

        const isHttps = targetUrl.protocol === 'https:'
        const lib     = isHttps ? https : http
        const auth    = Buffer.from(`${username ?? ''}:${apiToken ?? ''}`).toString('base64')

        const options: http.RequestOptions = {
          hostname:           targetUrl.hostname,
          port:               targetUrl.port || (isHttps ? 443 : 80),
          path:               targetUrl.pathname + targetUrl.search,
          method:             req.method ?? 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept':        'application/json',
            'Content-Type':  'application/json',
          },
          rejectUnauthorized: false,
        }

        const proxyReq = lib.request(options, (proxyRes) => {
          res.statusCode = proxyRes.statusCode ?? 200
          res.setHeader('Content-Type', proxyRes.headers['content-type'] ?? 'application/json')
          proxyRes.pipe(res)
        })

        proxyReq.setTimeout(15000, () => {
          proxyReq.destroy()
          res.statusCode = 504
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Jira request timed out after 15s' }))
        })

        proxyReq.on('error', (err: Error) => {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        })

        req.pipe(proxyReq)
      })
    },
  }
}

// ─── Vite config ──────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), jiraProxyPlugin()],
  base: './',   // required for Electron — loads assets with relative paths
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
