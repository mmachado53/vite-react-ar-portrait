import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server:{
    allowedHosts: ['249c90d0048b.ngrok.app', '*']
  }
})
