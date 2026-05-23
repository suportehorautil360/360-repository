import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Mostra um aviso "nova versão disponível" em vez de recarregar sozinho.
      registerType: 'prompt',
      includeAssets: [
        'favicon1.svg',
        'logo.png',
        'apple-touch-icon-180x180.png',
      ],
      manifest: {
        name: 'Hora Útil 360',
        short_name: 'HU360',
        description: 'Gestão de frota, frentes de trabalho e abastecimento.',
        theme_color: '#090f1f',
        background_color: '#090f1f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache do app shell (build assets).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA: rotas desconhecidas caem no index.html...
        navigateFallback: '/index.html',
        // ...exceto chamadas ao Firestore/APIs (não interceptar dados dinâmicos).
        navigateFallbackDenylist: [/^\/api/, /firestore\.googleapis\.com/],
        // Não cacheamos o backend do Firestore via SW (a fase 2 usa o cache do próprio Firestore).
        runtimeCaching: [],
      },
      // Em dev o SW fica desligado por padrão (não atrapalha o HMR).
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
