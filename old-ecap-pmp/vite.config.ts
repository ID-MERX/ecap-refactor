import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  envPrefix: ["VITE_", "REACT_"],
  server: {
    host: "::",
    port: 3040,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxy Superset API requests to avoid CORS issues in development
      "/superset-api": {
        target: "http://localhost:3005",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/superset-api/, ""),
      },
    },
    allowedHosts: ["ecapplus.pmp.bluecodeltd.com", "ecapplus.stage.pmp.bluecodeltd.com"],
  },
  preview: {
    host: "::",
    port: 3040,
    allowedHosts: ["ecapplus.pmp.bluecodeltd.com", "ecapplus.stage.pmp.bluecodeltd.com"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Stable third-party libs in their own long-lived chunk so an app
        // deploy doesn't bust the vendor cache for returning users.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("react-dom") ||
              id.includes("/react/") ||
              id.includes("react-router") ||
              id.includes("scheduler") ||
              id.includes("@tanstack")
            ) {
              return "react-vendor";
            }
          }
        },
      },
    },
  },
}));
