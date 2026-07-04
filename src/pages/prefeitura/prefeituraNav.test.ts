import { describe, expect, it } from "vitest";
import { prefeituraNav } from "./prefeituraNav";

describe("prefeituraNav — gating de Abastecimento", () => {
  it("inclui o grupo Abastecimento quando a flag está on", () => {
    const grupos = prefeituraNav("pref-1", { flags: { abastecimento: true } });
    const grupo = grupos.find((g) => g.label === "Abastecimento");
    expect(grupo).toBeDefined();
    expect(
      grupo?.items.some((i) => i.to === "/prefeitura/pref-1/abastecimento"),
    ).toBe(true);
  });

  it("não inclui o grupo Abastecimento quando a flag está off", () => {
    const grupos = prefeituraNav("pref-1", { flags: { abastecimento: false } });
    expect(grupos.find((g) => g.label === "Abastecimento")).toBeUndefined();
  });

  it("default (sem opts) não mostra Abastecimento (opt-in)", () => {
    const grupos = prefeituraNav("pref-1");
    expect(grupos.find((g) => g.label === "Abastecimento")).toBeUndefined();
  });
});

describe("prefeituraNav — gating dos accordions de grupo", () => {
  it("mostra Gestão de Frota, Manutenção, Pessoas/RH e Qualidade por padrão", () => {
    const grupos = prefeituraNav("pref-1");
    const labels = grupos.map((g) => g.label);
    expect(labels).toContain("Gestão de Frota");
    expect(labels).toContain("Manutenção");
    expect(labels).toContain("Pessoas / RH");
    expect(labels).toContain("Qualidade e Segurança");
  });

  it("esconde um grupo quando a flag correspondente é false", () => {
    const grupos = prefeituraNav("pref-1", { flags: { manutencao: false } });
    expect(grupos.find((g) => g.label === "Manutenção")).toBeUndefined();
    expect(grupos.find((g) => g.label === "Gestão de Frota")).toBeDefined();
  });

  it("Principal e Sistema aparecem sempre (não têm flag)", () => {
    const grupos = prefeituraNav("pref-1", {
      flags: { frota: false, manutencao: false, pessoas: false, qualidade: false },
    });
    const labels = grupos.map((g) => g.label);
    expect(labels).toContain("Principal");
    expect(labels).toContain("Sistema");
  });

  it("itens de ponto dependem de flags.ponto dentro de Pessoas/RH", () => {
    const semPonto = prefeituraNav("pref-1", { flags: { pessoas: true } });
    const grupoSem = semPonto.find((g) => g.label === "Pessoas / RH");
    expect(
      grupoSem?.items.some((i) => i.to === "/prefeitura/pref-1/pontos-rh"),
    ).toBe(false);

    const comPonto = prefeituraNav("pref-1", {
      flags: { pessoas: true, ponto: true },
    });
    const grupoCom = comPonto.find((g) => g.label === "Pessoas / RH");
    expect(
      grupoCom?.items.some((i) => i.to === "/prefeitura/pref-1/pontos-rh"),
    ).toBe(true);
  });
});
