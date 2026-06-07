import { describe, expect, it } from "vitest";
import { itensDaCategoria } from "./itens";

describe("itensDaCategoria", () => {
  it("renumera o Nº sequencial e único (1..N)", () => {
    const itens = itensDaCategoria("Escavadeira");
    expect(itens.length).toBeGreaterThan(0);
    const nums = itens.map((it) => it["Nº"]);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("não repete itens (dedup por texto)", () => {
    const itens = itensDaCategoria("Escavadeira");
    const textos = itens.map((it) => String(it["Item de Verificação"]));
    expect(new Set(textos).size).toBe(textos.length);
  });

  it("categoria inexistente devolve lista vazia", () => {
    expect(itensDaCategoria("__nao_existe__")).toEqual([]);
  });
});
