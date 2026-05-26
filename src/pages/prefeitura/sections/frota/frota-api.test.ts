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

const vehicleApi = {
  id: "abc",
  name: "HB20 2021",
  plate: "CAR-001",
  type: "carro",
  year: 2021,
  currentMeter: 12000,
  brand: "Hyundai",
  maintenanceInterval: 10000,
  maintenanceUnit: "km",
  prefeituraId: "pref-1",
  lastRevisionOdometerReading: 0,
  obra: "Galpão Industrial Norte",
  status: "ativo",
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  delMock.mockReset();
});

describe("frotaApi.listar", () => {
  it("mapeia o veículo do backend para o modelo de UI", async () => {
    getMock.mockResolvedValue({ data: [vehicleApi], message: "ok" });

    const [v] = await frotaApi.listar("pref-1");

    expect(getMock).toHaveBeenCalledWith("/vehicles/pref-1");
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

  it("trata 404 (sem veículos) como lista vazia", async () => {
    getMock.mockRejectedValue(new ApiError(404, "Nenhum veículo"));
    await expect(frotaApi.listar("pref-1")).resolves.toEqual([]);
  });

  it("repropaga erros que não são 404", async () => {
    getMock.mockRejectedValue(new ApiError(500, "boom"));
    await expect(frotaApi.listar("pref-1")).rejects.toThrow("boom");
  });

  it("normaliza tipo desconhecido e obra vazia", async () => {
    getMock.mockResolvedValue({
      data: [{ ...vehicleApi, type: "Caminhão", obra: "  " }],
      message: "ok",
    });
    const [v] = await frotaApi.listar("pref-1");
    expect(v.tipo).toBe("caminhao");
    expect(v.obra).toBe("Disponível");
  });
});

describe("frotaApi.criar", () => {
  it("envia o DTO mapeado e devolve o veículo mapeado", async () => {
    postMock.mockResolvedValue(vehicleApi);

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
      "/vehicles",
      expect.objectContaining({
        name: "HB20 2021",
        plate: "CAR-001",
        type: "maquina",
        maintenanceUnit: "hours",
        prefeituraId: "pref-1",
        lastRevisionOdometerReading: 50,
        obra: "Disponível",
      }),
    );
    expect(novo.id).toBe("abc");
  });
});

describe("frotaApi.atualizar / remover", () => {
  it("atualizar faz POST no endpoint update com o id", async () => {
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
      "/vehicles/update/abc",
      expect.objectContaining({ currentMeter: 13000 }),
    );
  });

  it("remover faz DELETE pelo id", async () => {
    delMock.mockResolvedValue(undefined);
    await frotaApi.remover("abc");
    expect(delMock).toHaveBeenCalledWith("/vehicles/abc");
  });
});

describe("frotaApi.concluirRevisao", () => {
  it("faz POST em /revision/complete com o payload mapeado", async () => {
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
    expect(path).toBe("/revision/complete");
    expect(body).toMatchObject({
      odometerReading: 15000,
      mechanicOrOfficeName: "Oficina X",
      servicesDescription: "Troca de óleo",
      revisionCost: 200,
      invoiceNumber: "NF-1",
      prefeituraId: "pref-1",
      vehicleId: "abc",
    });
    expect(body.revisionDate).toContain("2026-05-25");
  });
});
