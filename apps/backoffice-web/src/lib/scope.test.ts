import { describe, expect, it } from "vitest";
import { type Me, initialScope, permissionsIn, scopeOptions } from "./scope";

const owner: Me = {
  userId: "u-owner",
  storeRoles: ["OWNER"],
  storePermissions: ["ORDER_VIEW", "STAFF_VIEW", "AUDIT_VIEW"],
  branches: [],
};

const manager: Me = {
  userId: "u-manager",
  storeRoles: [],
  storePermissions: [],
  branches: [
    { branchId: "b-q1", roles: ["MANAGER"], permissions: ["ORDER_VIEW", "STAFF_VIEW"] },
    { branchId: "b-q3", roles: ["BARISTA"], permissions: ["ORDER_PREPARE"] },
  ],
};

describe("workspace scope (Staff Operations §16.2, Decision M4)", () => {
  it("offers the whole store to STORE roles, then their branches", () => {
    const withBranch = { ...owner, branches: [{ branchId: "b-q1", roles: ["MANAGER"], permissions: ["ORDER_VIEW"] }] };
    expect(scopeOptions(withBranch)).toEqual([{ kind: "store" }, { kind: "branch", branchId: "b-q1" }]);
  });

  it("offers a Manager only the assigned branches", () => {
    expect(scopeOptions(manager)).toEqual([
      { kind: "branch", branchId: "b-q1" },
      { kind: "branch", branchId: "b-q3" },
    ]);
  });

  it("uses store permissions in the store scope and the branch's merged permissions in a branch", () => {
    expect([...permissionsIn(owner, { kind: "store" })]).toEqual(owner.storePermissions);
    expect([...permissionsIn(manager, { kind: "branch", branchId: "b-q3" })]).toEqual(["ORDER_PREPARE"]);
  });

  it("grants nothing for a branch the user is not assigned to", () => {
    expect(permissionsIn(manager, { kind: "branch", branchId: "b-other" }).size).toBe(0);
  });

  it("applies STORE permissions at a branch the STORE role is not listed for", () => {
    expect([...permissionsIn(owner, { kind: "branch", branchId: "b-any" })]).toEqual(owner.storePermissions);
  });

  it("starts in the last-used branch only while it is still an option (a preference, not a grant)", () => {
    expect(initialScope(manager, "b-q3")).toEqual({ kind: "branch", branchId: "b-q3" });
    expect(initialScope(manager, "b-gone")).toEqual({ kind: "branch", branchId: "b-q1" });
    expect(initialScope(owner, null)).toEqual({ kind: "store" });
  });

  it("has no scope when the user has no role anywhere", () => {
    expect(initialScope({ ...manager, branches: [] }, null)).toBeNull();
  });
});
