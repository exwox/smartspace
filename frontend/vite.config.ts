import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend dev server default :3001, frontend dev :5173
const proxyTarget =
  (globalThis as any).process?.env?.VITE_API_PROXY || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})