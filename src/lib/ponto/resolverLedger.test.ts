import { describe, expect, it } from "vitest";
import { resolverLedger } from "./resolverLedger";
import type { PontoRegistro } from "../api/pontos";

function original(over: Partial<PontoRegistro>): PontoRegistro {
  return {
    id: "o1",
    name: "João",
    prefeituraId: "p1",
    tipo: "entrada",
    timestampOriginal: "2026-05-25T11:00:00.000Z",
    registro: "original",
    nsr: 1,
    ...over,
  };
}

describe("resolverLedger", () => {
  it("mantém a original quando não há ajustes", () => {
    const out = resolverLedger([original({})]);
    expect(out).toHaveLength(1);
    expect(out[0].timestampOriginal).toBe("2026-05-25T11:00:00.000Z");
    expect(out[0].ajustePendente).toBeUndefined();
  });

  it("ajuste PENDENTE mantém o horário original e marca a pendência", () => {
    const out = resolverLedger([
      original({ nsr: 1 }),
      {
        id: "a1",
        name: "João",
        prefeituraId: "p1",
        tipo: "entrada",
        timestampOriginal: "2026-05-25T12:00:00.000Z",
        registro: "ajuste",
        refNsr: 1,
        aplicado: false,
        nsr: 2,
      },
    ]);
    expect(out).toHaveLength(1);
    // Oficial segue sendo o original.
    expect(out[0].timestampOriginal).toBe("2026-05-25T11:00:00.000Z");
    expect(out[0].ajustePendente).toBe(true);
    expect(out[0].horarioAjustePendente).toBe("2026-05-25T12:00:00.000Z");
  });

  it("ajuste APLICADO troca o horário oficial", () => {
    const out = resolverLedger([
      original({ nsr: 1 }),
      {
        id: "a1",
        name: "João",
        prefeituraId: "p1",
        tipo: "entrada",
        timestampOriginal: "2026-05-25T12:00:00.000Z",
        registro: "ajuste",
        refNsr: 1,
        aplicado: true,
        nsr: 2,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].timestampOriginal).toBe("2026-05-25T12:00:00.000Z");
    expect(out[0].horarioAnterior).toBe("2026-05-25T11:00:00.000Z");
    expect(out[0].ajustePendente).toBeUndefined();
  });

  it("cancelamento aplicado descarta a original", () => {
    const out = resolverLedger([
      original({ nsr: 1 }),
      {
        id: "c1",
        name: "João",
        prefeituraId: "p1",
        tipo: "entrada",
        timestampOriginal: "2026-05-25T11:00:00.000Z",
        registro: "cancelamento",
        refNsr: 1,
        aplicado: true,
        nsr: 2,
      },
    ]);
    expect(out).toHaveLength(0);
  });

  it("inclusão aprovada (ajuste sem alvo) vira batida efetiva", () => {
    const out = resolverLedger([
      {
        id: "i1",
        name: "João",
        prefeituraId: "p1",
        tipo: "entrada",
        timestampOriginal: "2026-05-25T13:00:00.000Z",
        registro: "ajuste",
        refNsr: null,
        aplicado: true,
        nsr: 5,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].timestampOriginal).toBe("2026-05-25T13:00:00.000Z");
  });

  it("casa ajuste por refId quando a original é legada (sem NSR)", () => {
    const out = resolverLedger([
      original({ id: "leg", nsr: undefined, registro: undefined }),
      {
        id: "a1",
        name: "João",
        prefeituraId: "p1",
        tipo: "entrada",
        timestampOriginal: "2026-05-25T12:30:00.000Z",
        registro: "ajuste",
        refId: "leg",
        aplicado: true,
        nsr: 2,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].timestampOriginal).toBe("2026-05-25T12:30:00.000Z");
  });

  it("compat. legado: batida status='cancelado' é descartada", () => {
    const out = resolverLedger([
      original({ registro: undefined, status: "cancelado" }),
    ]);
    expect(out).toHaveLength(0);
  });
});
