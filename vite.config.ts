import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { handleGeminiRequest } from './api/_lib/geminiProxy.ts'

/**
 * In sviluppo replica la funzione serverless /api/ai/gemini (la stessa usata su Vercel),
 * così la chiave Gemini resta sul server anche in locale e non finisce mai nel bundle.
 */
function geminiDevProxy(env: Record<string, string>): Plugin {
  return {
    name: 'unicalendar-gemini-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai/gemini', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Metodo non consentito.' }))
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', async () => {
          let body: unknown = {}
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { /* corpo vuoto */ }
          const result = await handleGeminiRequest(req.headers.authorization, body, {
            GEMINI_API_KEY: env.GEMINI_API_KEY,
            FIREBASE_API_KEY: env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY,
          })
          res.statusCode = result.status
          res.end(JSON.stringify(result.body))
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefisso '' = legge anche le variabili senza VITE_ (solo lato server, mai esposte al client)
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      geminiDevProxy(env),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'UniCalendar',
          short_name: 'UniCal',
          description: 'Calendario per il supporto allo studio universitario',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Le chiamate API non devono mai essere intercettate dalla navigazione offline della PWA
          navigateFallbackDenylist: [/^\/api\//],
        }
      })
    ],
  }
})
