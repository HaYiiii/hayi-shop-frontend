import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../lib/api";
import {
  type Category,
  type CategoryNode,
  type CategoryPatch,
  type CategoryReorderRequest,
  archiveCategory,
  categoryKeys,
  categoryTreeQuery,
  createCategory,
  reorderCategories,
  updateCategory,
} from "../api/categories";

export function useCategoryTree(includeArchived: boolean) {
  const api = useApi();
  return useQuery(categoryTreeQuery(api, includeArchived));
}

/**
 * After a write every cached tree (with and without archived ones) may be out of date: positions,
 * versions and parents change together, so the tree is reloaded rather than patched.
 */
function useReloadTrees() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: categoryKeys.all });
}

export function useCreateCategory() {
  const api = useApi();
  const reload = useReloadTrees();
  return useMutation({
    mutationFn: (body: Parameters<typeof createCategory>[1]) => createCategory(api, body),
    onSuccess: () => reload(),
  });
}

/** On `412 VERSION_CONFLICT` the cache is left alone: the form keeps what the user typed (API README §8). */
export function useUpdateCategory() {
  const api = useApi();
  const reload = useReloadTrees();
  return useMutation({
    mutationFn: ({ category, body }: { category: Category; body: CategoryPatch }) => updateCategory(api, category, body),
    onSuccess: () => reload(),
  });
}

export function useArchiveCategory() {
  const api = useApi();
  const reload = useReloadTrees();
  return useMutation({
    mutationFn: (category: Category) => archiveCategory(api, category),
    onSuccess: () => reload(),
  });
}

/** The group in its new order; ids not in the group are ignored, missing ones keep their place at the end. */
function reorderGroup<T extends Category>(group: readonly T[], categoryIds: readonly string[]): T[] {
  const byId = new Map(group.map((c) => [c.categoryId, c]));
  const moved = categoryIds.flatMap((id) => byId.get(id) ?? []);
  return [...moved, ...group.filter((c) => !categoryIds.includes(c.categoryId))];
}

export function reorderTree(tree: readonly CategoryNode[], { parentId, categoryIds }: CategoryReorderRequest): CategoryNode[] {
  if (parentId === null) return reorderGroup(tree, categoryIds);
  return tree.map((root) =>
    root.categoryId === parentId ? { ...root, children: reorderGroup(root.children, categoryIds) } : root,
  );
}

/**
 * Moves the group at once in every cached tree (optimistic), then takes the server's active tree.
 * `409 CATALOG_CATEGORY_ORDER_STALE` or any error puts the old order back and reloads (Decision Y6).
 */
export function useReorderCategories() {
  const api = useApi();
  const queryClient = useQueryClient();
  const reload = useReloadTrees();
  return useMutation({
    mutationFn: (body: CategoryReorderRequest) => reorderCategories(api, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previous = queryClient.getQueriesData<CategoryNode[]>({ queryKey: categoryKeys.all });
      for (const [key, tree] of previous) {
        if (tree) queryClient.setQueryData(key, reorderTree(tree, body));
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      for (const [key, tree] of context?.previous ?? []) queryClient.setQueryData(key, tree);
      void reload();
    },
    onSuccess: (tree) => {
      queryClient.setQueryData(categoryKeys.tree(false), tree);
      // The archived view holds the same moves plus archived rows: refresh it from the server.
      void queryClient.invalidateQueries({ queryKey: categoryKeys.tree(true) });
    },
  });
}
