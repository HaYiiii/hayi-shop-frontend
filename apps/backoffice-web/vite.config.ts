import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Same-origin API in dev so the HttpOnly cookies (Path=/api/backoffice) and hy_csrf just work.
const apiTarget = process.env.HAYI_API_TARGET ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": { target: apiTarget, changeOrigin: false } } },
  preview: { proxy: { "/api": { target: apiTarget, changeOrigin: false } } },
});
