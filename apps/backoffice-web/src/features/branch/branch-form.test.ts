import { describe, expect, it } from "vitest";
import { type Branch, createBody, fieldErrors, fieldsOf, parseLocation, patchBody } from "./branch-form";

const branch: Branch = {
  branchId: "b-q1",
  branchCode: "Q1-LELOI",
  name: "Quận 1 · Lê Lợi",
  status: "ACTIVE",
  address: { line: "68 Lê Lợi", ward: "Bến Nghé", district: "Quận 1", province: "TP.HCM" },
  location: { lat: 10.7757, lng: 106.7019 },
  phone: "02838380000",
  email: "q1@hayi.vn",
  timezone: "Asia/Ho_Chi_Minh",
  activatedAt: "2026-09-02T03:00:00Z",
  closedAt: null,
  createdAt: "2026-08-28T03:00:00Z",
  version: 3,
};

const empty = { branchCode: "", name: "", line: "", ward: "", district: "", province: "", location: "", phone: "", email: "" };

describe("parseLocation", () => {
  it("reads 'lat, lng'", () => {
    expect(parseLocation(" 10.7757, 106.7019 ")).toEqual({ lat: 10.7757, lng: 106.7019 });
  });

  it("treats a blank field as no coordinates", () => {
    expect(parseLocation("  ")).toBeNull();
  });

  it.each(["10.7757", "abc, def", "91, 106", "10, 181", "10.1, 106.2, 3"])("rejects %s", (text) => {
    expect(parseLocation(text)).toBe("invalid");
  });
});

describe("createBody (API 09 §1.1)", () => {
  it("trims values and leaves out optional fields that are blank", () => {
    expect(
      createBody({ ...empty, branchCode: " q1-nguyenhue ", name: " HaYi Nguyễn Huệ ", line: "12 Nguyễn Huệ", province: "TP.HCM" }),
    ).toEqual({
      branchCode: "Q1-NGUYENHUE",
      name: "HaYi Nguyễn Huệ",
      address: { line: "12 Nguyễn Huệ", province: "TP.HCM" },
    });
  });

  it("sends every optional field that has a value", () => {
    expect(
      createBody({
        branchCode: "Q1-NGUYENHUE",
        name: "HaYi Nguyễn Huệ",
        line: "12 Nguyễn Huệ",
        ward: "Bến Nghé",
        district: "Quận 1",
        province: "TP.HCM",
        location: "10.7757, 106.7019",
        phone: "02838380000",
        email: "q1@hayi.vn",
      }),
    ).toEqual({
      branchCode: "Q1-NGUYENHUE",
      name: "HaYi Nguyễn Huệ",
      address: { line: "12 Nguyễn Huệ", ward: "Bến Nghé", district: "Quận 1", province: "TP.HCM" },
      location: { lat: 10.7757, lng: 106.7019 },
      phone: "02838380000",
      email: "q1@hayi.vn",
    });
  });
});

describe("patchBody — JSON Merge Patch of the changed fields only (API 09 §1.2)", () => {
  it("is empty when nothing changed", () => {
    expect(patchBody(branch, fieldsOf(branch))).toEqual({});
  });

  it("sends only the changed keys, nested address keys included", () => {
    expect(patchBody(branch, { ...fieldsOf(branch), name: "Quận 1 · Lê Lợi 2", ward: "Phường Bến Thành" })).toEqual({
      name: "Quận 1 · Lê Lợi 2",
      address: { ward: "Phường Bến Thành" },
    });
  });

  it("clears an optional field emptied by the user with null", () => {
    expect(patchBody(branch, { ...fieldsOf(branch), district: " ", phone: "", email: "", location: "" })).toEqual({
      address: { district: null },
      location: null,
      phone: null,
      email: null,
    });
  });

  it("sends new coordinates as both lat and lng", () => {
    expect(patchBody(branch, { ...fieldsOf(branch), location: "10.7758, 106.702" })).toEqual({
      location: { lat: 10.7758, lng: 106.702 },
    });
  });

  it("adds coordinates to a Branch that had none", () => {
    const without = { ...branch, location: null };
    expect(fieldsOf(without).location).toBe("");
    expect(patchBody(without, { ...fieldsOf(without), location: "10.7, 106.7" })).toEqual({ location: { lat: 10.7, lng: 106.7 } });
  });
});

describe("fieldErrors — Problem `errors[]` onto the form fields", () => {
  it("maps nested API fields to form field names", () => {
    expect(
      fieldErrors([
        { field: "address.line", code: "MUST_NOT_BE_BLANK", message: "Không được để trống" },
        { field: "location.lat", code: "OUT_OF_RANGE" },
        { field: "branchCode", code: "PATTERN" },
      ]),
    ).toEqual({ line: "Không được để trống", location: "Giá trị chưa hợp lệ.", branchCode: "Giá trị chưa hợp lệ." });
  });
});
