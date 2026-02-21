import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Generate source maps only in dev — smaller prod bundles
    sourcemap: false,
    // Target modern evergreen browsers — no unnecessary down-compilation polyfills
    target: 'esnext',
    // Warn on chunks > 400 kB
    chunkSizeWarningLimit: 400,
    // Explicitly enabled: splits CSS per-chunk (Vite default, prevents override)
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Split vendor (node_modules) into a separate chunk so it stays cached
        // across app updates (content-hash changes only when deps change)
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
        // Deterministic asset file naming with content hash for long-term caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Minify with esbuild (default, fastest)
    minify: 'esbuild',
  },
  // Speed up dev server warm-up by pre-bundling heavy deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
  },
})
