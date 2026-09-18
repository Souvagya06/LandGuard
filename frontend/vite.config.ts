import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        alerts: resolve(__dirname, 'alerts.html'),
        sendAlert: resolve(__dirname, 'send-alert.html'),
        simulate: resolve(__dirname, 'simulate.html'),
        reports: resolve(__dirname, 'reports.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  },
})
