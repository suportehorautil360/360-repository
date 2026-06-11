import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config dedicada aos testes (sem o plugin PWA, que não é necessário aqui).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mesmo alias do vite.config (necessário para componentes que usam "@/").
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // O módulo virtual do vite-plugin-pwa não existe sem o plugin — os
      // testes usam um stub (e mockam por cima quando precisam).
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Só testes unitários em src/ — os E2E ficam em e2e/ (Playwright).
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
