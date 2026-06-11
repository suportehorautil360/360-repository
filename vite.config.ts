import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// URL do backend NestJS (back-360-). Em dev, o proxy abaixo encaminha
// as chamadas de `/api/*` pra cá, evitando CORS. Override via env BACKEND_URL.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // O front chama `/api/vehicles`; o backend expõe `/vehicles`.
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Mostra um aviso "nova versão disponível" em vez de recarregar sozinho.
      registerType: "prompt",
      includeAssets: [
        "favicon1.svg",
        "logo.png",
        "apple-touch-icon-180x180.png",
      ],
      manifest: {
        name: "Hora Útil 360",
        short_name: "HU360",
        description: "Gestão de frota, frentes de trabalho e abastecimento.",
        theme_color: "#090f1f",
        background_color: "#090f1f",
        display: "standalone",
        orientation: "portrait",
        start_url: "/checklist-login",
        scope: "/",
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache do app shell (build assets).
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // PWA focado no operador de checklist: NÃO pré-cacheamos os chunks das
        // outras áreas (admin/prefeitura/posto/oficina/locação) nem o pdfjs (OCR
        // do admin). Mantém a instalação leve no device do operador. O checklist
        // (e o jspdf que ele usa, em ChecklistHistoricoLista) segue no precache.
        globIgnores: [
          // SheetJS (xlsx) só é usado na importação de funcionários (admin/
          // prefeitura) — fora do fluxo do operador, não precacheia.
          "**/xlsx-*.js",
          // recharts (gráficos do painel da prefeitura) — fora do checklist.
          "**/PainelCharts-*.js",
          "**/recharts-*.js",
          // Chunk compartilhado do Sheet (shadcn) + react-phone-number-input
          // (metadata de DDI, ~200KB) — só usado em admin/prefeitura, nunca no
          // checklist do operador. Mantém o precache enxuto.
          "**/sheet-*.js",
          "**/AdminPage-*.{js,css}",
          "**/DashboardSection-*.{js,css}",
          "**/PortalPostoSection-*.{js,css}",
          "**/OficinasPostosSection-*.{js,css}",
          "**/CadastroClientesSection-*.{js,css}",
          "**/AcessosLoginsSection-*.{js,css}",
          "**/EquipamentosLocacaoSection-*.{js,css}",
          "**/ChecklistsSection-*.{js,css}",
          "**/AdminPortal*Page-*.{js,css}",
          "**/PrefeituraPage-*.{js,css}",
          "**/OficinaPage-*.{js,css}",
          "**/LocacaoPage-*.{js,css}",
          "**/PostoPage-*.{js,css}",
          "**/PostoPortalProvider-*.{js,css}",
          "**/postoPortal*-*.js",
          "**/EmergenciaTable-*.{js,css}",
          "**/pdf-*.js",
          "**/pdf.worker.min-*.js",
          // Deps de jsPDF.html() — o checklist gera PDF com addImage, não precisa.
          "**/html2canvas-*.js",
          "**/index.es-*.js",
          "**/purify.es-*.js",
        ],
        // SPA: rotas desconhecidas caem no index.html...
        navigateFallback: "/index.html",
        // ...exceto chamadas ao Firestore/APIs (não interceptar dados dinâmicos).
        navigateFallbackDenylist: [/^\/api/, /firestore\.googleapis\.com/],
        // Chunks fora do precache (outras áreas) ainda são cacheados ao serem
        // usados online — assim funcionam offline depois, sem pesar a instalação.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/assets\/.*\.js$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-chunks",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      // Em dev o SW fica desligado por padrão (não atrapalha o HMR).
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
