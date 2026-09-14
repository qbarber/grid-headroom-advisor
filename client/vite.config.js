import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api to the Express server (src/server.js, default port 3001) so
// the browser sees same-origin requests during dev -- no CORS setup needed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Replit serves the preview through a dynamic *.replit.dev hostname.
    allowedHosts: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:3001',
    },
  },
});
