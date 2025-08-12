import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      '29c17112-19d3-458f-9e3f-c35427ce0db9-00-1brhi1qlb68rk.picard.replit.dev',
      'localhost',
      '.replit.dev',
      '.repl.co'
    ],
    hmr: {
      port: 5173,
      host: '0.0.0.0'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173
  }
})
