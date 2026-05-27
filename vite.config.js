import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Supabase + React suman ~570kb gzipped = ~155kb — aceptable para MVP
    // TODO: agregar dynamic imports por ruta cuando se escale
    chunkSizeWarningLimit: 600,
  },
})
