// Next.js app: react + @next/eslint-plugin-next (core web vitals).
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import { react } from "./react.js";

/** @param {{ tsconfigRootDir: string }} options */
export function next(options) {
  return defineConfig(react(options), {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs["core-web-vitals"].rules },
  });
}
