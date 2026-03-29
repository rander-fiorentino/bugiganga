import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, existsSync } from 'fs'

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'))
      const icon = resolve(__dirname, 'public/icon.png')
      if (existsSync(icon)) copyFileSync(icon, resolve(__dirname, 'dist/icon.png'))
    },
  }
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  build: {
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'sidebar.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@bugiganga/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@bugiganga/dom-utils': resolve(__dirname, '../../packages/dom-utils/src/index.ts'),
      '@bugiganga/agent-core': resolve(__dirname, '../../packages/agent-core/src/index.ts'),
    },
  },
})
