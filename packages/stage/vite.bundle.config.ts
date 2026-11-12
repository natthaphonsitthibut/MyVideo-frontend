import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** Stage bundle for the renderer: one IIFE, no hashes in names (the manifest carries the checksums). */
export default defineConfig({
  logLevel: 'warn',
  // library mode keeps `process.env.NODE_ENV` (immer reads it) — the render page has no `process`
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: fileURLToPath(new URL('./dist-bundle', import.meta.url)),
    emptyOutDir: true,
    copyPublicDir: false,
    target: 'es2023',
    lib: {
      entry: fileURLToPath(new URL('./bundle/entry.ts', import.meta.url)),
      name: 'MyVideoStage',
      formats: ['iife'],
      fileName: () => 'stage.js',
    },
  },
});
