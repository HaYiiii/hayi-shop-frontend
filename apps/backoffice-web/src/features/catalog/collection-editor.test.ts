import { describe, expect, it } from "vitest";
import type { Collection } from "./api/collections";
import { addProduct, collectionChanges, draftOfCollection, moveProduct, rebaseDraft, removeProduct, reorderCollections, textErrors } from "./collection-editor";

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

describe("reorderCollections", () => {
  const moves = (list: Collection[], id: string, by: -1 | 1) => reorderCollections(list, id, by)?.map((s) => [s.collection.collectionId, s.sortOrder]);

  it("renumbers past gaps so no two collections share a sortOrder (a0 c2 d3 e4, e up)", () => {
    expect(moves([collection("a", 0), collection("c", 2), collection("d", 3), collection("e", 4)], "e", -1)).toEqual([
      ["c", 1],
      ["e", 2],
    ]);
  });

  it("breaks ties and sends only the collections that change", () => {
    expect(moves([collection("a", 0), collection("b", 0), collection("c", 5)], "c", -1)).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
    expect(moves([collection("a", 0), collection("b", 1), collection("c", 2)], "b", 1)).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
    expect(reorderCollections([collection("a", 0)], "a", -1)).toBeNull();
  });
});

describe("rebaseDraft", () => {
  it("keeps what was typed and takes the rest from the newer version", () => {
    const base = collection("mua-thu", 0, ["p1", "p2"]);
    const latest = { ...base, name: "Thu", slug: "thu", productIds: ["p1", "p2", "p3"], version: 3 };
    const draft = { ...draftOfCollection(base), name: "Mùa thu 2026" };
    expect(rebaseDraft(base, draft, latest)).toEqual({ name: "Mùa thu 2026", slug: "thu", productIds: ["p1", "p2", "p3"] });
  });
});
