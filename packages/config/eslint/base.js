// Shared ESLint flat config (canonical SOURCE-STRUCTURE §4: "FE: typecheck, lint, test, build").
// TypeScript is linted with type information; plain JS (configs, scripts) without it.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * @param {{ tsconfigRootDir: string, project?: string }} options `project` names a tsconfig that covers
 *   every linted TS file (libraries whose build tsconfig leaves tests out); otherwise the nearest
 *   tsconfig.json of each file is used.
 */
export function base({ tsconfigRootDir, project }) {
  return defineConfig(
    globalIgnores(["**/dist/**", "**/.next/**", "**/.turbo/**", "**/src/generated/**", "**/*.gen.ts", "**/next-env.d.ts"]),
    {
      files: ["**/*.{js,mjs,ts,tsx}"],
      extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        parserOptions: project
          ? { project, tsconfigRootDir }
          : { projectService: true, tsconfigRootDir },
      },
      rules: {
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      },
    },
    {
      // Fakes in tests mirror async APIs (fetch) without awaiting anything themselves.
      files: ["**/*.test.{ts,tsx}"],
      rules: { "@typescript-eslint/require-await": "off" },
    },
    {
      // Plain JS and tool configs (vite, vitest, playwright, next) may sit outside every tsconfig.
      files: ["**/*.{js,mjs}", "**/*.config.ts"],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: globals.node },
    },
  );
}
