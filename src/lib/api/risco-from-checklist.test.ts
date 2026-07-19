import { describe, expect, it } from "vitest";
import type { ChecklistRegistroApi } from "./checklists-registros";
import {
  contarNaoDoRegistro,
  mapRegistroParaRisco,
} from "./risco-from-checklist";

function baseDoc(
  overrides: Partial<ChecklistRegistroApi> = {},
): ChecklistRegistroApi {
  return {
    id: "r1",
    dataHoraIso: "2026-07-15T12:00:00.000Z",
    operador: "João",
    chassis: "CH-1",
    categoria: "Escavadeira",
    modelo: "X",
    linha: "A",
    totalItens: 10,
    totalSim: 8,
    pontuacao: 16,
    horimetro: "100",
    assinaturaOperador: "data:image/png;base64,x",
    respostas: {},
    obs: null,
    localizacaoGps: null,
    prefeituraId: "pref-1",
    idOperadorSession: "op-1",
    itensNao: [],
    ...overrides,
  };
}

describe("contarNaoDoRegistro / mapRegistroParaRisco", () => {
  it("não trata N/A como Não (bug antigo totalItens - totalSim)", () => {
    // 8 Sim + 2 N/A → totalItens 10, totalSim 8; fórmula antiga dava Alto.
    const doc = baseDoc({
      totalItens: 10,
      totalSim: 8,
      totalNao: 0,
      totalNa: 2,
      itensNao: [],
    });
    expect(contarNaoDoRegistro(doc)).toBe(0);
    expect(mapRegistroParaRisco(doc).nivel).toBe("Baixo");
  });

  it("classifica Médio com 1 Não e Alto com ≥2", () => {
    const medio = baseDoc({
      itensNao: [{ titulo: "Freios", problema: "sem pressão" }],
    });
    expect(mapRegistroParaRisco(medio).nivel).toBe("Médio");
    expect(mapRegistroParaRisco(medio).defeito).toBe("sem pressão");

    const alto = baseDoc({
      itensNao: [
        { titulo: "Freios", problema: "a" },
        { titulo: "Buzina", problema: "b" },
      ],
    });
    expect(mapRegistroParaRisco(alto).nivel).toBe("Alto");
  });

  it("usa totalNao quando itensNao veio vazio", () => {
    const doc = baseDoc({ totalNao: 2, itensNao: [] });
    expect(contarNaoDoRegistro(doc)).toBe(2);
    expect(mapRegistroParaRisco(doc).nivel).toBe("Alto");
  });
});
