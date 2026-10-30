import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.DC_MULTI_APP_BUILD === '1' ? '/system/' : '/',
  server: {
    port: 5174
  }
})



