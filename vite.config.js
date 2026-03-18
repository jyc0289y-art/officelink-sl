import { defineConfig } from 'vite';

export default defineConfig({
  base: '/marklink-sl/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    open: true,
  },
});
