import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs separately on :3000. In production one
    // Node server serves both, so the app always calls relative /api paths.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
