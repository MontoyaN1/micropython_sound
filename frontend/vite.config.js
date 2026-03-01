import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Configurar para JavaScript puro (no TypeScript)
      jsxRuntime: "automatic",
      babel: {
        plugins: [
          [
            "@babel/plugin-transform-react-jsx",
            {
              runtime: "automatic",
            },
          ],
        ],
      },
    }),
  ],
  // Configuración para producción
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Configuración del servidor de desarrollo
  server: {
    host: "0.0.0.0",
    port: 3000,
    // Proxy configurado para desarrollo sin nginx
    // Cuando se usa nginx-dev, el proxy no es necesario ya que nginx maneja el routing
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/ws": {
        target: "ws://backend:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  // Configuración para preview (cuando se usa nginx-dev)
  preview: {
    host: "0.0.0.0",
    port: 3000,
    // En modo preview, no configuramos proxy ya que nginx maneja el routing
  },
});
