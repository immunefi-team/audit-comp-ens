import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: __dirname,
  envDir: '..',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4012,
  },
  preview: {
    host: '127.0.0.1',
    port: 4012,
  },
})
