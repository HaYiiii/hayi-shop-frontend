import { react } from "@hayi/config/eslint/react.js";

export default [
  ...react({ tsconfigRootDir: import.meta.dirname }),
  {
    // TanStack Router: `throw redirect(...)` / `throw notFound()` are its control flow, not errors.
    files: ["src/routes/**/*.tsx"],
    rules: {
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@tanstack/router-core", name: ["Redirect", "NotFoundError"] }] },
      ],
    },
  },
];
