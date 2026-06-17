import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka só o equipamentosApi.listar — a lógica de isolamento/cache é o que testamos.
const { listarMock } = vi.hoisted(() => ({ listarMock: vi.fn() }));
vi.mock("../prefeitura/sections/equipamentos/equipamentos-api", () => ({
  equipamentosApi: { listar: listarMock },
}));

import { carregarFrotaOperador, lerCacheFrota } from "./frota-operador";

// Linha como o NestJS devolve (EquipRow); o mapeamento só usa esses campos.
const rowA = {
  id: "a1",
  descricao: "Trator A",
  chassis: "CH-A",
  modelo: "MX",
  linha: "L1",
  tipo: "Trator",
};

const equipA = {
  id: "a1",
  prefeituraId: "pref-1",
  label: "Trator A",
  chassis: "CH-A",
  modelo: "MX",
  linha: "L1",
  tipo: "Trator",
};

beforeEach(() => {
  listarMock.mockReset();
  localStorage.clear();
});

describe("carregarFrotaOperador", () => {
  it("fail-closed: sem prefeitura na sessão não busca nem devolve nada", async () => {
    const frota = await carregarFrotaOperador("");

    expect(frota).toEqual([]);
    expect(listarMock).not.toHaveBeenCalled();
  });

  it("busca no NestJS escopado por prefeitura e mapeia para o checklist", async () => {
    listarMock.mockResolvedValue([rowA]);

    const frota = await carregarFrotaOperador("pref-1");

    expect(listarMock).toHaveBeenCalledWith("pref-1");
    expect(frota).toEqual([equipA]);
  });

  it("cacheia a frota da prefeitura para uso offline", async () => {
    listarMock.mockResolvedValue([rowA]);

    await carregarFrotaOperador("pref-1");

    expect(lerCacheFrota("pref-1")).toEqual([equipA]);
  });

  it("offline (listar falha): cai no último cache DESTA prefeitura", async () => {
    listarMock.mockResolvedValueOnce([rowA]);
    await carregarFrotaOperador("pref-1"); // popula cache online

    listarMock.mockRejectedValueOnce(new Error("network"));
    const frota = await carregarFrotaOperador("pref-1");

    expect(frota).toEqual([equipA]);
  });

  it("nunca devolve a frota de outra prefeitura, mesmo offline", async () => {
    listarMock.mockResolvedValueOnce([rowA]);
    await carregarFrotaOperador("pref-1"); // cache só de pref-1

    listarMock.mockRejectedValueOnce(new Error("network"));
    const frotaB = await carregarFrotaOperador("pref-2"); // offline, sem cache próprio

    expect(frotaB).toEqual([]);
  });
});
