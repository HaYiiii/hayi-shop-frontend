// Generates TypeScript types from the backend OpenAPI specs (SOURCE-STRUCTURE.md §3.3).
// Local default: sibling repo ../hayi-shop-backend/api-spec. Override with HAYI_API_SPEC_DIR (e.g. CI artifact).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specDir = process.env.HAYI_API_SPEC_DIR ?? resolve(pkgDir, "../../../hayi-shop-backend/api-spec");
const bin = resolve(pkgDir, "node_modules/.bin/openapi-typescript");

for (const surface of ["public", "customer", "backoffice"]) {
  const input = resolve(specDir, `${surface}-v1.yaml`);
  if (!existsSync(input)) {
    console.error(`Spec not found: ${input} (set HAYI_API_SPEC_DIR)`);
    process.exit(1);
  }
  execFileSync(bin, [input, "-o", resolve(pkgDir, `src/generated/${surface}.ts`)], { stdio: "inherit" });
}
