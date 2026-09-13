import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/content-manager': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/content-type-builder': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/users-permissions': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
      '/i18n': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
    },
  },
})
