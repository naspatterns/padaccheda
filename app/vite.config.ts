import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  worker: { format: 'es' },
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('../engine/src', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
});
