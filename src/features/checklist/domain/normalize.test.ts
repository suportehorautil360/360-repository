import { describe, expect, it } from "vitest";
import { normalizeChassis, normalizeModelo } from "./normalize";

describe("normalizeChassis", () => {
  it("remove espaços e deixa em maiúsculas", () => {
    expect(normalizeChassis(" ab 12 cd ")).toBe("AB12CD");
    expect(normalizeChassis("xyz789")).toBe("XYZ789");
  });
});

describe("normalizeModelo", () => {
  it("colapsa espaços e deixa em minúsculas", () => {
    expect(normalizeModelo("  Escavadeira   320 D ")).toBe("escavadeira 320 d");
  });
});
