import { describe, expect, it } from "vitest";
import { fmtMin, minutosPrevistos, minutosTrabalhados } from "./horasPonto";
import type { PontoRegistro, TipoPonto } from "../../../lib/api/pontos";
import type { Escala } from "../../../lib/api/escala";

// Constrói a batida a partir de hora LOCAL (round-trip estável em qualquer TZ).
function reg(tipo: TipoPonto, h: number, m: number): PontoRegistro {
  return {
    id: tipo,
    name: "x",
    prefeituraId: "p",
    tipo,
    timestampOriginal: new Date(2026, 4, 26, h, m, 0).toISOString(),
  };
}

const escala: Escala = {
  prefeituraId: "p",
  inicio: "08:00",
  fim: "18:00",
  diasSemana: [1, 2, 3, 4, 5],
  almocoMinutos: 75,
};

describe("minutosTrabalhados", () => {
  it("soma manhã + tarde com as 4 batidas", () => {
    const dia = [
      reg("entrada", 8, 0),
      reg("almoco", 12, 0),
      reg("volta", 13, 0),
      reg("saida", 17, 0),
    ];
    expect(minutosTrabalhados(dia, 60)).toBe(480); // 8h
  });

  it("usa entrada→saída menos almoço da escala quando faltam as marcas", () => {
    const dia = [reg("entrada", 8, 0), reg("saida", 17, 0)];
    expect(minutosTrabalhados(dia, 60)).toBe(480); // 9h - 1h
  });

  it("retorna 0 sem batidas suficientes", () => {
    expect(minutosTrabalhados([reg("entrada", 8, 0)], 60)).toBe(0);
  });
});

describe("minutosPrevistos", () => {
  it("calcula a jornada do dia útil (08–18 menos 75min)", () => {
    expect(minutosPrevistos(escala, "2026-05-26")).toBe(525); // 08:45 (terça)
  });

  it("retorna 0 em dia fora da escala (domingo)", () => {
    expect(minutosPrevistos(escala, "2026-05-24")).toBe(0);
  });

  it("retorna 0 sem escala", () => {
    expect(minutosPrevistos(null, "2026-05-26")).toBe(0);
  });
});

describe("fmtMin", () => {
  it("formata positivos e negativos", () => {
    expect(fmtMin(525)).toBe("08:45");
    expect(fmtMin(-143)).toBe("-02:23");
  });
});
