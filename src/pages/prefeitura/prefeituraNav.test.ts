import { describe, expect, it } from "vitest";
import { prefeituraNav } from "./prefeituraNav";

describe("prefeituraNav — gating de Abastecimento", () => {
  it("inclui o grupo Abastecimento quando abastecimentoAtivo=true", () => {
    const grupos = prefeituraNav("pref-1", { abastecimentoAtivo: true });
    const grupo = grupos.find((g) => g.label === "Abastecimento");
    expect(grupo).toBeDefined();
    expect(
      grupo?.items.some((i) => i.to === "/prefeitura/pref-1/abastecimento"),
    ).toBe(true);
  });

  it("não inclui o grupo Abastecimento quando a flag está off", () => {
    const grupos = prefeituraNav("pref-1", { abastecimentoAtivo: false });
    expect(grupos.find((g) => g.label === "Abastecimento")).toBeUndefined();
  });

  it("default (sem opts) não mostra Abastecimento", () => {
    const grupos = prefeituraNav("pref-1");
    expect(grupos.find((g) => g.label === "Abastecimento")).toBeUndefined();
  });
});
