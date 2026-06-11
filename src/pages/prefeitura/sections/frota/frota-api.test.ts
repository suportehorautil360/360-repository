import { beforeEach, describe, expect, it, vi } from "vitest";

// Mantém o ApiError real (frota-api usa instanceof) e troca só os métodos `api`.
const { getMock, postMock, delMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("../../../../lib/api/client", async (orig) => {
  const actual = await orig<typeof import("../../../../lib/api/client")>();
  return { ...actual, api: { get: getMock, post: postMock, del: delMock } };
});

import { frotaApi } from "./frota-api";
import { ApiError } from "../../../../lib/api/client";

// Documento como vem da coleção `equipamentos` (fonte da verdade).
const equipDoc = {
  id: "abc",
  descricao: "HB20 2021",
  label: "HB20 2021",
  marca: "Hyundai",
  placa: "CAR-001",
  chassis: "CAR-001",
  tipo: "Carro",
  ano: "2021",
  medicaoAtual: 12000,
  intervaloRevisao: 10000,
  ultimaRevisao: 0,
  unidadeRevisao: "km",
  obra: "Galpão Industrial Norte",
  status: "ativo",
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  delMock.mockReset();
});

describe("frotaApi.listar", () => {
  it("mapeia o equipamento para o modelo de UI da Frota", async () => {
    getMock.mockResolvedValue({ data: [equipDoc], message: "ok" });

    const [v] = await frotaApi.listar("pref-1");

    expect(getMock).toHaveBeenCalledWith("/equipamentos/pref-1");
    expect(v).toMatchObject({
      id: "abc",
      placa: "CAR-001",
      nome: "HB20 2021",
      marca: "Hyundai",
      tipo: "carro",
      ano: 2021,
      medicaoAtual: 12000,
      intervaloRevisao: 10000,
      ultimaRevisao: 0,
      obra: "Galpão Industrial Norte",
      status: "ativo",
    });
  });

  it("trata 404 (sem itens) como lista vazia", async () => {
    getMock.mockRejectedValue(new ApiError(404, "Nenhum equipamento"));
    await expect(frotaApi.listar("pref-1")).resolves.toEqual([]);
  });

  it("repropaga erros que não são 404", async () => {
    getMock.mockRejectedValue(new ApiError(500, "boom"));
    await expect(frotaApi.listar("pref-1")).rejects.toThrow("boom");
  });

  it("horímetro vira tipo 'maquina' e obra vazia vira 'Disponível'", async () => {
    getMock.mockResolvedValue({
      data: [
        {
          ...equipDoc,
          tipo: "Escavadeira",
          unidadeRevisao: "h",
          obra: "  ",
        },
      ],
      message: "ok",
    });
    const [v] = await frotaApi.listar("pref-1");
    expect(v.tipo).toBe("maquina");
    expect(v.obra).toBe("Disponível");
  });
});

describe("frotaApi.criar", () => {
  it("envia o payload de equipamento e devolve o modelo mapeado", async () => {
    postMock.mockResolvedValue({ data: equipDoc });

    const novo = await frotaApi.criar(
      {
        placa: "CAR-001",
        nome: "HB20 2021",
        marca: "Hyundai",
        tipo: "maquina",
        ano: 2021,
        medicaoAtual: 100,
        intervaloRevisao: 250,
        ultimaRevisao: 50,
        obra: "",
      },
      "pref-1",
    );

    expect(postMock).toHaveBeenCalledWith(
      "/equipamentos",
      expect.objectContaining({
        descricao: "HB20 2021",
        chassis: "CAR-001",
        placa: "CAR-001",
        tipo: "Máquina",
        unidadeRevisao: "h",
        prefeituraId: "pref-1",
        intervaloRevisao: 250,
        ultimaRevisao: 50,
      }),
    );
    expect(novo.id).toBe("abc");
  });
});

describe("frotaApi.atualizar / remover", () => {
  it("atualizar faz POST em /equipamentos/update/:id", async () => {
    postMock.mockResolvedValue({});
    await frotaApi.atualizar(
      {
        id: "abc",
        placa: "CAR-001",
        nome: "HB20",
        marca: "Hyundai",
        tipo: "carro",
        ano: 2021,
        medicaoAtual: 13000,
        intervaloRevisao: 10000,
        ultimaRevisao: 0,
        obra: "Disponível",
        status: "ativo",
      },
      "pref-1",
    );
    expect(postMock).toHaveBeenCalledWith(
      "/equipamentos/update/abc",
      expect.objectContaining({ medicaoAtual: 13000, unidadeRevisao: "km" }),
    );
  });

  it("remover faz DELETE em /equipamentos/:id", async () => {
    delMock.mockResolvedValue(undefined);
    await frotaApi.remover("abc");
    expect(delMock).toHaveBeenCalledWith("/equipamentos/abc");
  });
});

describe("frotaApi.concluirRevisao", () => {
  it("faz POST em /equipamentos/revision/complete com equipamentoId", async () => {
    postMock.mockResolvedValue({});
    const veiculo = { id: "abc" } as never;

    await frotaApi.concluirRevisao(veiculo, "pref-1", {
      data: "2026-05-25",
      hodometro: 15000,
      oficina: "Oficina X",
      servicos: "Troca de óleo",
      custo: 200,
      notaFiscal: "NF-1",
    });

    const [path, body] = postMock.mock.calls[0];
    expect(path).toBe("/equipamentos/revision/complete");
    expect(body).toMatchObject({
      odometerReading: 15000,
      mechanicOrOfficeName: "Oficina X",
      servicesDescription: "Troca de óleo",
      revisionCost: 200,
      invoiceNumber: "NF-1",
      prefeituraId: "pref-1",
      equipamentoId: "abc",
    });
    expect(body.revisionDate).toContain("2026-05-25");
  });
});
