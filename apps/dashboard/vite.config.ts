import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/agent': 'http://localhost:3000',
      '/memory': 'http://localhost:3000',
      '/tools': 'http://localhost:3000',
      '/planner': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
