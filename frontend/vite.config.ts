import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Serve the root /docs folder as static assets at /docs/*
  publicDir: 'public',
  server: {
    port: 5173,
    // Proxy /docs/* requests to the actual docs directory in the monorepo root
    proxy: {},
    fs: {
      // Allow serving files from the parent directory (for docs)
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
