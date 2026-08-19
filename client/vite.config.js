import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API is a separate Express process in development. Proxying it under
    // the same origin as the page is what lets the session cookie be a plain
    // same-site httpOnly cookie rather than a cross-origin one.
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:4000",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
