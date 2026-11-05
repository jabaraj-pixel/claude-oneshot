import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 2_000_000, // Inline all audio & image assets as base64 data URIs for standalone single-HTML build
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
