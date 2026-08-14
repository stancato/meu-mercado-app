import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'firebase-vendor'
          if (id.includes('@mui') || id.includes('@emotion')) return 'ui-vendor'
          if (id.includes('react')) return 'react-vendor'
        },
      },
    },
  },
})
