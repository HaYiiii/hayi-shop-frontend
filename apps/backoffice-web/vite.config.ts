import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Same-origin API in dev so the HttpOnly cookies (Path=/api/backoffice) and hy_csrf just work.
const apiTarget = process.env.HAYI_API_TARGET ?? "http://localhost:8080";

export default defineConfig({
  // File-based routes in src/routes (SOURCE-STRUCTURE §3.1); the router plugin must come before react().
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true, routeFileIgnorePattern: "\\.test\\.tsx?$" }), react(), tailwindcss()],
  server: { proxy: { "/api": { target: apiTarget, changeOrigin: false } } },
  preview: { proxy: { "/api": { target: apiTarget, changeOrigin: false } } },
});
