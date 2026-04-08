import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone by default. Set VITE_BASE_PATH="/apps/nexus/" for nested deployment.
const basePath = process.env.VITE_BASE_PATH || '/'
const apiProxyPath = basePath === '/' ? '/api' : `${basePath}api`

export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: {
    port: 5175,
    proxy: {
      [apiProxyPath]: {
        target: 'http://localhost:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${apiProxyPath.replace('/', '\\/')}`), '/api'),
      },
    },
  },
})
