import { describe, expect, it } from "vitest";
import { formText } from "./form";

function form(html: string): HTMLFormElement {
  const el = document.createElement("form");
  el.innerHTML = html;
  return el;
}

describe("formText", () => {
  it("returns the text of a field", () => {
    expect(formText(form('<input name="code" value="482 913">'), "code")).toBe("482 913");
  });

  it("returns an empty string for a missing field or a file", () => {
    expect(formText(form(""), "code")).toBe("");
    expect(formText(form('<input type="file" name="code">'), "code")).toBe("");
  });
});
