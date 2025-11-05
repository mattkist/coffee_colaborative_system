import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Usa base apenas em produção (GitHub Pages)
  // Em desenvolvimento local, base é '/' (raiz)
  base: mode === 'production' ? '/cafe_grao/' : '/',
}))




