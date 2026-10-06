import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@models': path.resolve(__dirname, '../backend/src/models'),
      '@dto': path.resolve(__dirname, '../backend/src/dto'),
      // Fonte única da tabela ICMS (backend); evita drift FE↔BE.
      '@importflow/icms': path.resolve(__dirname, '../backend/src/utils/icmsByUf.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
