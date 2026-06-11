import { describe, expect, it } from "vitest";
import { linkGoogleMaps } from "./maps";

describe("linkGoogleMaps", () => {
  it("monta a URL de busca a partir de 'lat, lng'", () => {
    expect(linkGoogleMaps("-20.751234, -51.678999")).toBe(
      "https://www.google.com/maps/search/?api=1&query=-20.751234%2C%20-51.678999",
    );
  });

  it("vazio/nulo retorna string vazia", () => {
    expect(linkGoogleMaps("")).toBe("");
    expect(linkGoogleMaps("   ")).toBe("");
    expect(linkGoogleMaps(null)).toBe("");
    expect(linkGoogleMaps(undefined)).toBe("");
  });
});
