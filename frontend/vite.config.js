import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// `define` substitutions to public/ files. This plugin runs after the full
// name per deployment without any manual version bumping.

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5181',
        changeOrigin: true
      }
    }
  },



  // ─── Build-time constants injected into every bundle ────────────────────────
  // runs. The Service Worker uses this as its cache bucket name, so every
  // production deployment automatically generates a new, unique cache key.
  // Developers never need to manually bump a version string.
  define: {
    
  },

  build: {
    // Warn only for extremely large chunks
    chunkSizeWarningLimit: 600,
    // Enable CSS code splitting for more efficient loading
    cssCodeSplit: true,
    // Rollup output options for manual chunk splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core into its own cached chunk
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor'
          }
          // Router into its own chunk
          if (id.includes('node_modules/react-router-dom/') || id.includes('node_modules/react-router/')) {
            return 'router'
          }
          // Icon library into its own chunk (large but shared across all pages)
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons'
          }
          // xlsx and papaparse (only used in admin/batch upload)
          if (id.includes('node_modules/xlsx/') || id.includes('node_modules/papaparse/')) {
            return 'spreadsheet'
          }
          // QR code libraries (used in admin + verify)
          if (id.includes('node_modules/qrcode') || id.includes('node_modules/html5-qrcode')) {
            return 'qr'
          }
          // PDF generation (certificate download)
          if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/@pdf-lib')) {
            return 'generateCertificate'
          }
        },
      },
    },
  },
  // Pre-bundle all project dependencies upfront to avoid late discovery / full reload during client-side navigation
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
      'lucide-react',
      'framer-motion',
      'recharts',
      'xlsx',
      'papaparse',
      'pdf-lib',
      '@pdf-lib/fontkit',
      'qrcode.react',
      'html5-qrcode',
      'html2pdf.js',
      'lottie-web',
      'lottie-react',
    ],
  },
})