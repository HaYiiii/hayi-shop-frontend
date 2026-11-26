import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type * as Ui from "@hayi/ui";

afterEach(cleanup);

// Radix (behind @hayi/ui's Dialog) runs another React copy in Vitest: a plain dialog stands in (see plain-dialog.tsx).
vi.mock("@hayi/ui", async (importOriginal) => {
  const ui = await importOriginal<typeof Ui>();
  const { PlainDialog } = await import("./test/plain-dialog");
  return { ...ui, Dialog: PlainDialog };
});
