import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper, fakeApi, json, problem } from "../../../test/fake-api";
import { type Category, type CategoryNode, aCategory, aTree, categoryResponse } from "../test/categories";
import {
  useArchiveCategory,
  useCategoryTree,
  useCreateCategory,
  useReorderCategories,
  useUpdateCategory,
} from "./use-categories";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The tree hook and one mutation hook sharing a cache, as on the screen. */
function renderWithTree<T>(useMutationHook: () => T, includeArchived = false) {
  return renderHook(
    () => ({ tree: useCategoryTree(includeArchived), mutation: useMutationHook() }),
    { wrapper: createTestWrapper() },
  );
}

describe("useCategoryTree", () => {
  it("loads the active tree by default and the archived one on request", async () => {
    const api = fakeApi({ "GET /categories": () => json(aTree()) });
    const { result, rerender } = renderHook(({ archived }) => useCategoryTree(archived), {
      wrapper: createTestWrapper(),
      initialProps: { archived: false },
    });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    rerender({ archived: true });
    await waitFor(() => expect(api.calls).toHaveLength(2));
    const urls = (vi.mocked(fetch).mock.calls as [Request][]).map(([r]) => new URL(r.url).search);
    expect(urls).toEqual(["", "?includeArchived=true"]);
  });
});

describe("useUpdateCategory", () => {
  it("sends a merge patch with If-Match of the version on screen and reloads the tree", async () => {
    let tree = aTree();
    const api = fakeApi({
      "GET /categories": () => json(tree),
      "PATCH /categories/c-tea": () => {
        const saved = aCategory({ categoryId: "c-tea", name: "Trà trái cây", version: 4 });
        tree = aTree({ teaName: "Trà trái cây" });
        return categoryResponse(saved);
      },
    });
    const { result } = renderWithTree(useUpdateCategory);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());
    const tea = result.current.tree.data![0]!;

    await act(() => result.current.mutation.mutateAsync({ category: tea, body: { name: "Trà trái cây" } }));

    const call = api.calls.findLast((c) => c.route === "PATCH /categories/c-tea")!;
    expect(call.headers.get("If-Match")).toBe(`"v${tea.version}"`);
    expect(call.headers.get("Content-Type")).toBe("application/merge-patch+json");
    expect(call.body).toEqual({ name: "Trà trái cây" });
    await waitFor(() => expect(result.current.tree.data![0]!.name).toBe("Trà trái cây"));
  });

  it("keeps the tree as it is on VERSION_CONFLICT so the caller can offer a reload", async () => {
    fakeApi({
      "GET /categories": () => json(aTree()),
      "PATCH /categories/c-tea": () => problem(412, "VERSION_CONFLICT"),
    });
    const { result } = renderWithTree(useUpdateCategory);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());
    const tea = result.current.tree.data![0]!;

    await act(async () => {
      await result.current.mutation.mutateAsync({ category: tea, body: { name: "X" } }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.mutation.error).toMatchObject({ code: "VERSION_CONFLICT" }));
    expect(result.current.tree.data![0]!.name).toBe("Trà");
  });
});

describe("useCreateCategory", () => {
  it("posts the new Category and reloads the tree", async () => {
    let tree = aTree();
    const api = fakeApi({
      "GET /categories": () => json(tree),
      "POST /categories": () => {
        tree = aTree({ extraRoot: aCategory({ categoryId: "c-cake", name: "Bánh", slug: "banh", sortOrder: 3 }) });
        return categoryResponse(aCategory({ categoryId: "c-cake", name: "Bánh", slug: "banh" }), 201);
      },
    });
    const { result } = renderWithTree(useCreateCategory);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());

    await act(() => result.current.mutation.mutateAsync({ slug: "banh", name: "Bánh" }));

    expect(api.bodyOf("POST /categories")).toEqual({ slug: "banh", name: "Bánh" });
    await waitFor(() => expect(result.current.tree.data).toHaveLength(3));
  });
});

describe("useArchiveCategory", () => {
  it("archives with If-Match and reloads the tree", async () => {
    let tree = aTree();
    const api = fakeApi({
      "GET /categories": () => json(tree),
      "POST /categories/c-milk/archive": () => {
        tree = aTree({ withoutMilk: true });
        return categoryResponse(aCategory({ categoryId: "c-milk", status: "ARCHIVED", version: 3 }));
      },
    });
    const { result } = renderWithTree(useArchiveCategory);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());
    const milk = result.current.tree.data![1]!;

    await act(() => result.current.mutation.mutateAsync(milk));

    const call = api.calls.findLast((c) => c.route === "POST /categories/c-milk/archive")!;
    expect(call.headers.get("If-Match")).toBe(`"v${milk.version}"`);
    await waitFor(() => expect(result.current.tree.data).toHaveLength(1));
  });
});

describe("useReorderCategories", () => {
  it("shows the new order at once and keeps the server's tree", async () => {
    let release: (r: Response) => void = () => undefined;
    const api = fakeApi({
      "GET /categories": () => json(aTree()),
      "PUT /categories/order": () => new Promise<Response>((resolve) => (release = resolve)),
    });
    const { result } = renderWithTree(useReorderCategories);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());

    act(() => result.current.mutation.mutate({ parentId: null, categoryIds: ["c-milk", "c-tea"] }));

    await waitFor(() => expect(ids(result.current.tree.data!)).toEqual(["c-milk", "c-tea"]));
    expect(api.bodyOf("PUT /categories/order")).toEqual({ parentId: null, categoryIds: ["c-milk", "c-tea"] });
    expect(api.calls.findLast((c) => c.route === "PUT /categories/order")!.headers.get("If-Match")).toBeNull();

    const reordered = aTree({ milkFirst: true });
    act(() => release(json(reordered)));
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));
    expect(result.current.tree.data).toEqual(reordered.items);
  });

  it("reorders children inside their parent", async () => {
    fakeApi({
      "GET /categories": () => json(aTree()),
      "PUT /categories/order": () => new Promise<Response>(() => undefined),
    });
    const { result } = renderWithTree(useReorderCategories);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());

    act(() => result.current.mutation.mutate({ parentId: "c-tea", categoryIds: ["c-tea-peach", "c-tea-lychee"] }));

    await waitFor(() => expect(ids(result.current.tree.data![0]!.children)).toEqual(["c-tea-peach", "c-tea-lychee"]));
  });

  it("puts the old order back and reloads on CATALOG_CATEGORY_ORDER_STALE", async () => {
    const api = fakeApi({
      "GET /categories": () => json(aTree()),
      "PUT /categories/order": () => problem(409, "CATALOG_CATEGORY_ORDER_STALE"),
    });
    const { result } = renderWithTree(useReorderCategories);
    await waitFor(() => expect(result.current.tree.data).toBeDefined());

    await act(async () => {
      await result.current.mutation
        .mutateAsync({ parentId: null, categoryIds: ["c-milk", "c-tea"] })
        .catch(() => undefined);
    });

    expect(ids(result.current.tree.data!)).toEqual(["c-tea", "c-milk"]);
    await waitFor(() => expect(api.calls.filter((c) => c.route === "GET /categories")).toHaveLength(2));
  });
});

function ids(categories: readonly (Category | CategoryNode)[]) {
  return categories.map((c) => c.categoryId);
}
