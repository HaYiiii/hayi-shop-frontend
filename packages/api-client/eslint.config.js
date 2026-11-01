import { base } from "@hayi/config/eslint/base.js";

// Tests are outside the build tsconfig; tsconfig.test.json covers all of src.
export default base({ tsconfigRootDir: import.meta.dirname, project: "./tsconfig.test.json" });
