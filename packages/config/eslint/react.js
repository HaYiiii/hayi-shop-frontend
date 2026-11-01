// React apps and packages: base + Rules of Hooks and the React Compiler checks of eslint-plugin-react-hooks.
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import { base } from "./base.js";

/** @param {{ tsconfigRootDir: string }} options */
export function react(options) {
  return defineConfig(base(options), {
    files: ["**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  });
}
