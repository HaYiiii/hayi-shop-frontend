import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // @hayi/ui links its own React for its tests; components rendered here must share the app's one copy.
  // (Radix dialogs still load @hayi/ui's React through CommonJS: test-setup.ts stands in a plain dialog.)
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
