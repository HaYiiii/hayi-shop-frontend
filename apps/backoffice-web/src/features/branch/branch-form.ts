import type { BackofficeComponents } from "@hayi/api-client";

type Schemas = BackofficeComponents["schemas"];
export type Branch = Schemas["Branch"];
export type BranchStatus = Schemas["BranchStatus"];
export type BranchConflict = Schemas["BranchConflict"];
type GeoPoint = Schemas["GeoPoint"];
type BranchCreateRequest = Schemas["BranchCreateRequest"];
type BranchPatch = Schemas["BranchPatch"];

/** The Branch form's text fields, named as its inputs. */
export interface BranchFields {
  branchCode: string;
  name: string;
  line: string;
  ward: string;
  district: string;
  province: string;
  /** "lat, lng" in one field (D3c). */
  location: string;
  phone: string;
  email: string;
}

export type BranchFieldName = keyof BranchFields;

export const fieldNames: readonly BranchFieldName[] = [
  "branchCode",
  "name",
  "line",
  "ward",
  "district",
  "province",
  "location",
  "phone",
  "email",
];

export function readFields(form: HTMLFormElement): BranchFields {
  const data = new FormData(form);
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };
  return Object.fromEntries(fieldNames.map((name) => [name, text(name)])) as unknown as BranchFields;
}

/** "10.7757, 106.7019" → a point; blank → `null`; anything else → `"invalid"`. */
export function parseLocation(text: string): GeoPoint | null | "invalid" {
  const value = text.trim();
  if (!value) return null;
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length !== 2 || parts.some((p) => p === "")) return "invalid";
  const [lat, lng] = parts.map(Number) as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return "invalid";
  return { lat, lng };
}

function locationText(location: GeoPoint | null): string {
  return location ? `${location.lat}, ${location.lng}` : "";
}

/** A valid location, assuming the form checked `parseLocation` first. */
function locationOf(text: string): GeoPoint | null {
  const parsed = parseLocation(text);
  return parsed === "invalid" ? null : parsed;
}

export function fieldsOf(branch: Branch): BranchFields {
  return {
    branchCode: branch.branchCode,
    name: branch.name,
    line: branch.address.line,
    ward: branch.address.ward ?? "",
    district: branch.address.district ?? "",
    province: branch.address.province,
    location: locationText(branch.location),
    phone: branch.phone ?? "",
    email: branch.email ?? "",
  };
}

/** `POST /branches` body: trimmed, blank optional fields left out (API 09 §1.1). */
export function createBody(fields: BranchFields): BranchCreateRequest {
  const optional = (value: string) => value.trim() || undefined;
  const location = locationOf(fields.location);
  const ward = optional(fields.ward);
  const district = optional(fields.district);
  const phone = optional(fields.phone);
  const email = optional(fields.email);
  return {
    branchCode: fields.branchCode.trim().toUpperCase(),
    name: fields.name.trim(),
    address: {
      line: fields.line.trim(),
      ...(ward && { ward }),
      ...(district && { district }),
      province: fields.province.trim(),
    },
    ...(location && { location }),
    ...(phone && { phone }),
    ...(email && { email }),
  };
}

/** JSON Merge Patch of what changed: missing key keeps the value, `null` clears an optional field (API 09 §1.2). */
export function patchBody(branch: Branch, fields: BranchFields): BranchPatch {
  const before = fieldsOf(branch);
  const changed = (name: BranchFieldName) => fields[name].trim() !== before[name].trim();
  const optional = (name: BranchFieldName) => fields[name].trim() || null;

  const address: NonNullable<BranchPatch["address"]> = {
    ...(changed("line") && { line: fields.line.trim() }),
    ...(changed("ward") && { ward: optional("ward") }),
    ...(changed("district") && { district: optional("district") }),
    ...(changed("province") && { province: fields.province.trim() }),
  };
  const location = locationOf(fields.location);
  const locationChanged =
    location?.lat !== branch.location?.lat || location?.lng !== branch.location?.lng;

  return {
    ...(changed("name") && { name: fields.name.trim() }),
    ...(Object.keys(address).length > 0 && { address }),
    ...(locationChanged && { location }),
    ...(changed("phone") && { phone: optional("phone") }),
    ...(changed("email") && { email: optional("email") }),
  };
}

/** `errors[]` of a `400 VALIDATION_FAILED` on the form's fields; `address.line` → `line`, `location.lat` → `location`. */
export function fieldErrors(
  errors: readonly { field: string; code: string; message?: string }[],
): Partial<Record<BranchFieldName, string>> {
  const result: Partial<Record<BranchFieldName, string>> = {};
  for (const error of errors) {
    const [head = "", tail] = error.field.split(".");
    const name = (head === "address" ? tail : head) as BranchFieldName;
    if (fieldNames.includes(name)) result[name] ??= error.message ?? "Giá trị chưa hợp lệ.";
  }
  return result;
}
