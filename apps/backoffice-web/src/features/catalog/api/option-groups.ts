import type { BackofficeComponents } from "@hayi/api-client";
import { queryOptions } from "@tanstack/react-query";
import { type BackofficeClient, unwrap } from "../../../lib/api";

type Schemas = BackofficeComponents["schemas"];
export type OptionGroup = Schemas["OptionGroup"];
export type OptionItem = Schemas["OptionItem"];
export type OptionSelectionType = Schemas["OptionSelectionType"];
export type OptionStatus = Schemas["OptionStatus"];
export type OptionGroupCreateRequest = Schemas["OptionGroupCreateRequest"];
export type OptionGroupPatch = Schemas["OptionGroupPatch"];
export type OptionItemInput = Schemas["OptionItemInput"];
export type OptionItemPatch = Schemas["OptionItemPatch"];

export const optionGroupKeys = {
  all: ["option-groups"] as const,
  list: () => [...optionGroupKeys.all, "list"] as const,
};

const ifMatch = (group: OptionGroup) => ({ "If-Match": `"v${group.version}"` });
const mergePatch = { "Content-Type": "application/merge-patch+json" };

/** Every group with its items, archived ones too: the library shows them greyed (API 08 §1.5, Decision AB2). */
export function optionGroupsQuery(api: BackofficeClient) {
  return queryOptions({
    queryKey: optionGroupKeys.list(),
    queryFn: () =>
      unwrap(api.GET("/option-groups", { params: { query: { includeArchived: true } } })).then((list) => list.items),
  });
}

export function createOptionGroup(api: BackofficeClient, body: OptionGroupCreateRequest) {
  return unwrap(api.POST("/option-groups", { body }));
}

/** Merge Patch with `If-Match` of the group (Decision AB2). */
export function updateOptionGroup(api: BackofficeClient, group: OptionGroup, body: OptionGroupPatch) {
  return unwrap(
    api.PATCH("/option-groups/{optionGroupId}", {
      params: { path: { optionGroupId: group.optionGroupId }, header: ifMatch(group) },
      body,
      headers: mergePatch,
    }),
  );
}

/** Adds an item last; `If-Match` is optional, sent so a stale screen gets `412` (Decision AB1). */
export function addOptionItem(api: BackofficeClient, group: OptionGroup, body: OptionItemInput) {
  return unwrap(
    api.POST("/option-groups/{optionGroupId}/items", {
      params: { path: { optionGroupId: group.optionGroupId }, header: ifMatch(group) },
      body,
    }),
  );
}

/** Merge Patch of one item with `If-Match` = the group's version (Decision AB1). */
export function updateOptionItem(api: BackofficeClient, group: OptionGroup, optionItemId: string, body: OptionItemPatch) {
  return unwrap(
    api.PATCH("/option-groups/{optionGroupId}/items/{optionItemId}", {
      params: { path: { optionGroupId: group.optionGroupId, optionItemId }, header: ifMatch(group) },
      body,
      headers: mergePatch,
    }),
  );
}

export function archiveOptionGroup(api: BackofficeClient, group: OptionGroup) {
  return unwrap(
    api.POST("/option-groups/{optionGroupId}/archive", {
      params: { path: { optionGroupId: group.optionGroupId }, header: ifMatch(group) },
    }),
  );
}

export function archiveOptionItem(api: BackofficeClient, group: OptionGroup, optionItemId: string) {
  return unwrap(
    api.POST("/option-groups/{optionGroupId}/items/{optionItemId}/archive", {
      params: { path: { optionGroupId: group.optionGroupId, optionItemId }, header: ifMatch(group) },
    }),
  );
}
