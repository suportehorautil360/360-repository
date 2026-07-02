import { describe, expect, it } from "vitest";
import {
  inferLinhaFromTipo,
  normalizeEquip,
} from "./equipamentos-api";

describe("inferLinhaFromTipo", () => {
  it("mapeia carro leve para linha leve", () => {
    expect(inferLinhaFromTipo("Carro Leve")).toBe("Linha Leve");
  });

  it("mapeia escavadeira para linha amarela", () => {
    expect(inferLinhaFromTipo("Escavadeira")).toBe("Linha Amarela");
  });
});

describe("normalizeEquip", () => {
  it("corrige linha legada igual ao tipo", () => {
    const row = normalizeEquip("x1", {
      tipo: "Carro Leve",
      linha: "Carro Leve",
      marca: "BR1",
      modelo: "310L",
    });
    expect(row.linha).toBe("Linha Leve");
  });
});
