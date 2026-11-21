import { describe, expect, it } from "vitest";
import type { Collection } from "./api/collections";
import { addProduct, collectionChanges, draftOfCollection, moveProduct, removeProduct, swapCollections, textErrors } from "./collection-editor";

const collection = (collectionId: string, sortOrder: number, productIds: string[] = []): Collection => ({
  collectionId,
  slug: collectionId,
  name: collectionId.toUpperCase(),
  description: null,
  status: "ACTIVE",
  sortOrder,
  productIds,
  version: 2,
  createdAt: "2026-11-01T03:00:00Z",
  updatedAt: "2026-11-01T03:00:00Z",
});

describe("collection draft", () => {
  const autumn = collection("mua-thu", 0, ["p1", "p2", "p3"]);

  it("moves, removes and adds products; sends only what changed", () => {
    let draft = draftOfCollection(autumn);
    expect(collectionChanges(autumn, draft)).toEqual({ patch: null, productIds: null });
    draft = moveProduct(draft, "p2", -1);
    draft = removeProduct(draft, "p3");
    draft = addProduct(addProduct(draft, "p9"), "p9");
    draft = { ...draft, name: " Mùa thu 2026 " };
    expect(collectionChanges(autumn, draft)).toEqual({ patch: { name: "Mùa thu 2026" }, productIds: ["p2", "p1", "p9"] });
    expect(moveProduct(draft, "p2", -1)).toBe(draft);
  });

  it("checks name and slug against the limit", () => {
    expect(textErrors(" ", "Mùa Thu", 128)).toEqual({
      name: "Nhập tên.",
      slug: "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang, ví dụ mua-thu.",
    });
    expect(textErrors("Ít ngọt", "it-ngot", 64)).toEqual({});
  });
});

describe("swapCollections", () => {
  it("gives the two collections their new positions as sortOrder", () => {
    const list = [collection("a", 0), collection("b", 0), collection("c", 5)];
    expect(swapCollections(list, "c", -1)?.map((s) => [s.collection.collectionId, s.sortOrder])).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
    expect(swapCollections(list, "a", -1)).toBeNull();
  });
});
