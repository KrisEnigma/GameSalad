/* eslint-disable no-undef */
import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

export default defineConfig({
  base: "",
  appType: "spa",
  root: path.resolve(__dirname, "src"),
  publicDir: path.resolve(__dirname, "public"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => id.includes("tests"),
      output: {
        assetFileNames: "assets/[name].[hash][extname]",
        chunkFileNames: "assets/[name].[hash].js",
        entryFileNames: "assets/[name].[hash].js",
      },
    },
    sourcemap: true,
    assetsDir: "assets",
    copyPublicDir: true,
  },
  server: {
    port: 3000,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "ssl/key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "ssl/cert.pem")),
    },
    hmr: true,
  },
  preview: {
    port: 8080,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "ssl/key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "ssl/cert.pem")),
    },
  },
  // TypeScript configuration
  optimizeDeps: {
    esbuildOptions: {
      target: "es2020",
    },
  },
  esbuild: {
    target: "es2020",
  },
});
