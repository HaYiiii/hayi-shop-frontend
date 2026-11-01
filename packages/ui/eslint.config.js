import { react } from "@hayi/config/eslint/react.js";

// Tests are outside the build tsconfig; tsconfig.test.json covers all of src.
export default react({ tsconfigRootDir: import.meta.dirname, project: "./tsconfig.test.json" });
