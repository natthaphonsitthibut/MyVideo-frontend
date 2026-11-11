import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = process.env.MYVIDEO_API_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    // The browser always calls same-origin `/api/*`; in dev Vite forwards it to the NestJS API.
    proxy: { '/api': { target: apiTarget, rewrite: (path) => path.replace(/^\/api/, '') } },
  },
  preview: {
    host: '127.0.0.1',
    port: 4180,
    strictPort: true,
    proxy: { '/api': { target: apiTarget, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    maxWorkers: 2,
  },
});
