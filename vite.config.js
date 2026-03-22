import { defineConfig } from 'vite';

export default defineConfig({
  base: '/officelink-sl/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    open: true,
  },
});
