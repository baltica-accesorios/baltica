import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: en GitHub Pages el sitio vive en /baltica/. En un deploy propio (dominio del cliente) queda "/".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GH_PAGES ? '/baltica/' : '/',
})
