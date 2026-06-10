import { describe, expect, it } from "vitest";
import {
  buildSeedDefinitions,
  inferirDefinition,
  itensDaDefinition,
} from "./definitions-resolver";
import { itensDaCategoria } from "./itens";

const seed = buildSeedDefinitions();
const defByCat = (cat: string) => seed.find((d) => d.categoria === cat)!;

describe("itensDaDefinition — paridade com itensDaCategoria (invariante do Nº)", () => {
  for (const cat of [
    "Escavadeira",
    "Caminhão Munck",
    "Caminhão Pipa",
    "Ambulância",
    "Caminhões",
  ]) {
    it(`mantém Nº 1..N e textos idênticos: ${cat}`, () => {
      const viaDef = itensDaDefinition(defByCat(cat));
      const viaSeed = itensDaCategoria(cat);

      expect(viaDef.length).toBe(viaSeed.length);
      expect(viaDef.map((i) => i["Nº"])).toEqual(
        viaSeed.map((i) => i["Nº"]),
      );
      expect(viaDef.map((i) => i["Item de Verificação"])).toEqual(
        viaSeed.map((i) => String(i["Item de Verificação"])),
      );
      // Nº sequencial e único
      const nums = viaDef.map((i) => i["Nº"]);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
      expect(new Set(nums).size).toBe(nums.length);
    });
  }
});

describe("inferirDefinition — precedência por palavra-chave", () => {
  it("subtipos de caminhão vencem o genérico", () => {
    expect(inferirDefinition(seed, "Caminhão Munck XYZ", "")?.categoria).toBe(
      "Caminhão Munck",
    );
    expect(inferirDefinition(seed, "Caminhão Pipa 6m³", "")?.categoria).toBe(
      "Caminhão Pipa",
    );
    expect(
      inferirDefinition(seed, "Caminhão Basculante", "")?.categoria,
    ).toBe("Caminhão Basculante");
  });

  it("caminhão genérico resolve para Caminhões", () => {
    expect(inferirDefinition(seed, "Caminhão Carroceria", "")?.categoria).toBe(
      "Caminhões",
    );
  });

  it("usa o contexto (linha/tipo) além do label", () => {
    expect(
      inferirDefinition(seed, "VW 17.230", "", "linha leve")?.categoria,
    ).toBe("Carro Leve");
  });

  it("equipamento sem match conhecido devolve null", () => {
    expect(inferirDefinition(seed, "Drone Aéreo", "")).toBeNull();
  });

  it("Picador de Madeira vem no seed embutido com 25 itens", () => {
    const def = defByCat("Picador de Madeira");
    expect(def).toBeTruthy();
    expect(itensDaDefinition(def).length).toBe(25);
    expect(
      inferirDefinition(seed, "Picador Florestal PX-30", "")?.categoria,
    ).toBe("Picador de Madeira");
  });

  it("definição customizada nova casa por keyword própria", () => {
    const comPicador = [
      ...seed,
      {
        id: "x",
        nome: "Picador de Madeira",
        categoria: "Picador de Madeira",
        keywords: ["picador", "chipper"],
        ativo: true,
        version: 1,
        itens: [],
      },
    ];
    expect(
      inferirDefinition(comPicador, "Picador Florestal PX-30", "")?.categoria,
    ).toBe("Picador de Madeira");
  });
});
