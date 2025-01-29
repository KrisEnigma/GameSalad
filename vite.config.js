import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: 'www',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'www/index.html')
      },
      output: {
        entryFileNames: 'src/js/[name].js',
        chunkFileNames: 'src/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('/');
          const fileName = info[info.length - 1];
          const [name, ext] = fileName.split('.');

          if (assetInfo.source && assetInfo.source.toString().includes('public/')) {
            return assetInfo.name.replace('public/', '');
          }

          if (ext === 'css') {
            return `public/styles/${name}.${ext}`;
          }
          if (/\.(png|jpe?g|gif|svg|webp)$/i.test(ext)) {
            return `public/assets/images/${name}.${ext}`;
          }
          return `assets/${name}.${ext}`;
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'www/src')
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    https: {
      key: readFileSync('./ssl/key.pem'),
      cert: readFileSync('./ssl/cert.pem'),
    },
    headers: {
      'Service-Worker-Allowed': '/',
      'Access-Control-Allow-Origin': '*'
    }
  },
  publicDir: 'public'
});