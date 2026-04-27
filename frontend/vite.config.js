import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'EXT_BACKEND_'],
  plugins: [react(), tailwindcss()],
})
