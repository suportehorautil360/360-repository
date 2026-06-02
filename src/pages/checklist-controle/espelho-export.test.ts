import { describe, expect, it } from "vitest";
import {
  abonosNoPeriodo,
  construirEspelho,
  diasNoIntervalo,
  diasNoPeriodo,
  intervaloPreset,
} from "./espelho-export";
import type { PontoRegistro } from "./ponto-api";
import type { Abono } from "../../lib/api/abonos";

function bat(p: Partial<PontoRegistro>): PontoRegistro {
  return {
    id: p.id ?? "x",
    name: "Edmar",
    tipo: "entrada",
    timestampOriginal: "2026-06-02T08:00:00",
    status: "ok",
    ...p,
  } as PontoRegistro;
}

function abono(data: string, cpf = "00000000000"): Abono {
  return {
    funcionarioCpf: cpf,
    data,
    motivo: "Atestado",
  } as Abono;
}

describe("abonosNoPeriodo", () => {
  it("filtra por CPF e intervalo", () => {
    const abonos = [
      abono("2026-06-02"),
      abono("2026-06-20"),
      abono("2026-06-10", "99999999999"),
    ];
    const m = abonosNoPeriodo(abonos, "000.000.000-00", "2026-06-01", "2026-06-15");
    expect([...m.keys()]).toEqual(["2026-06-02"]);
  });

  it("sem CPF ou sem abonos retorna vazio", () => {
    expect(abonosNoPeriodo([], "000", "2026-06-01", "2026-06-30").size).toBe(0);
    expect(abonosNoPeriodo(undefined, undefined, "a", "b").size).toBe(0);
  });
});

describe("diasNoPeriodo", () => {
  it("agrupa batidas dentro do intervalo e ignora fora", () => {
    const batidas = [
      bat({ id: "1", timestampOriginal: "2026-06-02T08:00:00" }),
      bat({ id: "2", timestampOriginal: "2026-06-02T17:00:00", tipo: "saida" }),
      bat({ id: "3", timestampOriginal: "2026-07-01T08:00:00" }), // fora
    ];
    const dias = diasNoPeriodo(batidas, new Map(), "2026-06-01", "2026-06-30");
    expect(dias).toHaveLength(1);
    expect(dias[0][0]).toBe("2026-06-02");
    expect(dias[0][1]).toHaveLength(2);
  });

  it("inclui dias só com abono dentro do intervalo, ordenado", () => {
    const batidas = [bat({ timestampOriginal: "2026-06-05T08:00:00" })];
    const abonos = new Map<string, unknown>([
      ["2026-06-03", "x"],
      ["2026-07-10", "fora"],
    ]);
    const dias = diasNoPeriodo(batidas, abonos, "2026-06-01", "2026-06-30");
    expect(dias.map((d) => d[0])).toEqual(["2026-06-03", "2026-06-05"]);
  });
});

describe("intervaloPreset", () => {
  // Quarta-feira, 2026-06-17 (semana 15→21).
  const hoje = new Date(2026, 5, 17);

  it("hoje", () => {
    expect(intervaloPreset("hoje", hoje)).toEqual({
      de: "2026-06-17",
      ate: "2026-06-17",
    });
  });

  it("semana (segunda a domingo)", () => {
    expect(intervaloPreset("semana", hoje)).toEqual({
      de: "2026-06-15",
      ate: "2026-06-21",
    });
  });

  it("mês e mês anterior", () => {
    expect(intervaloPreset("mes", hoje)).toEqual({
      de: "2026-06-01",
      ate: "2026-06-30",
    });
    expect(intervaloPreset("mes-anterior", hoje)).toEqual({
      de: "2026-05-01",
      ate: "2026-05-31",
    });
  });
});

describe("diasNoIntervalo", () => {
  it("conta inclusivo e trata inválido", () => {
    expect(diasNoIntervalo("2026-06-01", "2026-06-30")).toBe(30);
    expect(diasNoIntervalo("2026-06-10", "2026-06-10")).toBe(1);
    expect(diasNoIntervalo("2026-06-10", "2026-06-09")).toBe(0);
    expect(diasNoIntervalo("", "2026-06-10")).toBe(0);
  });
});

describe("construirEspelho", () => {
  it("monta 8 colunas, marca abonado e fecha com TOTAIS", () => {
    const dias = diasNoPeriodo(
      [bat({ timestampOriginal: "2026-06-05T08:00:00" })],
      new Map<string, unknown>([["2026-06-03", "x"]]),
      "2026-06-01",
      "2026-06-30",
    );
    const { linhas, totais } = construirEspelho(
      dias,
      new Map<string, unknown>([["2026-06-03", "x"]]),
      null,
    );
    expect(linhas[0][0]).toBe("03/06/2026 (Abonado)");
    expect(linhas[0]).toHaveLength(8);
    expect(totais[0]).toBe("TOTAIS");
    expect(totais).toHaveLength(8);
  });
});
