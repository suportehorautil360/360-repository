import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config dedicada aos testes (sem o plugin PWA, que não é necessário aqui).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Só testes unitários em src/ — os E2E ficam em e2e/ (Playwright).
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
