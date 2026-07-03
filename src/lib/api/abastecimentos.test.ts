import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka só os métodos do `api`, mantendo o resto do módulo real.
const { getMock, delMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return { ...actual, api: { ...actual.api, get: getMock, del: delMock } };
});

import {
  abastecimentoListaParaTela,
  abastecimentosApi,
  fmtTotalAbastecimento,
  urlMapsAbastecimento,
  type AbastecimentoListaApi,
} from "./abastecimentos";

beforeEach(() => {
  getMock.mockReset();
  delMock.mockReset();
});

const apiItem: AbastecimentoListaApi = {
  id: "a1",
  dateTime: "10/06, 13:30",
  vehicle: { name: "Golf", plate: "ABC-1234", type: "Motoniveladora" },
  origin: "Posto Exemplo",
  postoId: "posto-1",
  liters: 1000,
  value: null,
  reading: "10 h",
  local: "Pirituba",
  createdAt: "2026-06-10T16:30:50.934Z",
};

describe("abastecimentoListaParaTela", () => {
  it("mapeia os campos do backend (en) para a tela (pt)", () => {
    expect(abastecimentoListaParaTela(apiItem)).toMatchObject({
      id: "a1",
      data: "10/06, 13:30",
      veiculo: "Golf",
      placa: "ABC-1234",
      litros: 1000,
      leitura: "10 h",
      local: "Pirituba",
      origemTipo: "posto",
    });
  });

  it("usa createdAt como fallback quando dateTime vem vazio", () => {
    const t = abastecimentoListaParaTela({ ...apiItem, dateTime: "" });
    expect(t.data).toMatch(/\d{2}\/\d{2}/); // formatou alguma data a partir do createdAt
  });

  it("classifica como comboio quando não há posto", () => {
    const t = abastecimentoListaParaTela({
      ...apiItem,
      postoId: null,
      origin: "Comboio",
    });
    expect(t.origemTipo).toBe("comboio");
  });

  it("repassa latitude e longitude para a tela", () => {
    const t = abastecimentoListaParaTela({
      ...apiItem,
      latitude: -23.55,
      longitude: -46.63,
    });
    expect(t.latitude).toBe(-23.55);
    expect(t.longitude).toBe(-46.63);
  });
});

describe("urlMapsAbastecimento", () => {
  it("monta link do Google Maps com coordenadas", () => {
    expect(urlMapsAbastecimento(-23.55, -46.63)).toBe(
      "https://www.google.com/maps?q=-23.55,-46.63",
    );
  });

  it("retorna null sem coordenadas", () => {
    expect(urlMapsAbastecimento(null, -46)).toBeNull();
    expect(urlMapsAbastecimento(undefined, undefined)).toBeNull();
  });
});

describe("abastecimentosApi.listarPorPeriodo", () => {
  it("normaliza a resposta do backend para linhas da tela", async () => {
    getMock.mockResolvedValue({ data: [apiItem] });
    const rows = await abastecimentosApi.listarPorPeriodo(
      "p1",
      "2026-06-01",
      "2026-06-10",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      veiculo: "Golf",
      litros: 1000,
      leitura: "10 h",
      data: "10/06, 13:30",
    });
  });

  it("envia startDate e endDate inclusivo (+1 dia) na query", async () => {
    getMock.mockResolvedValue({ data: [] });
    await abastecimentosApi.listarPorPeriodo("p1", "2026-06-01", "2026-06-10");
    const url = String(getMock.mock.calls[0][0]);
    expect(url).toContain("startDate=2026-06-01");
    expect(url).toContain("endDate=2026-06-11");
  });
});

describe("abastecimentosApi.listar (mapeia resposta real do backend en->pt)", () => {
  // Espelha exatamente o que `formatAbastecimento` do back-360- devolve.
  const backendPosto = {
    id: "a1",
    dateTime: "10/06, 13:30",
    vehicle: { name: "Golf", plate: "ABC-1234", type: "Motoniveladora" },
    origin: "Posto Exemplo",
    postoId: "posto-1",
    fuelType: "Diesel S10",
    liters: 1000,
    pricePerLiter: 5,
    value: 5000,
    status: "aprovado",
    reading: "1.234 km",
    currentReading: 1234,
    measurementType: "hodometro",
    meterPhoto: null,
    local: "Pirituba",
    createdAt: "2026-06-10T16:30:50.934Z",
  };

  it("preenche veiculo, litros, valor e leitura a partir dos campos en", async () => {
    getMock.mockResolvedValue({ data: [backendPosto] });
    const rows = await abastecimentosApi.listar("p1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      veiculo: "Golf",
      placa: "ABC-1234",
      tipoVeiculo: "Motoniveladora",
      combustivel: "Diesel S10",
      litros: 1000,
      valor: 5000,
      leitura: 1234,
      leituraUnidade: "km",
      origem: "posto",
      local: "Pirituba",
      status: "aprovado",
    });
    // data derivada do createdAt (ISO), para fmtData/ordenacao funcionarem.
    expect(rows[0].data).toMatch(/^2026-06-\d{2}$/);
  });

  it("classifica comboio e leitura em horas (horimetro)", async () => {
    getMock.mockResolvedValue({
      data: [
        {
          ...backendPosto,
          id: "c1",
          origin: "Comboio",
          postoId: null,
          fuelType: "Diesel S10",
          value: null,
          status: "aprovado",
          reading: "10 h",
          currentReading: 10,
          measurementType: "horimetro",
          local: "",
        },
      ],
    });
    const [row] = await abastecimentosApi.listar("p1");
    expect(row).toMatchObject({
      origem: "comboio",
      combustivel: "Diesel S10",
      leitura: 10,
      leituraUnidade: "h",
      valor: 0,
      status: "aprovado",
    });
  });

  it("normaliza status pendente_aprovacao", async () => {
    getMock.mockResolvedValue({
      data: [{ ...backendPosto, status: "pendente_aprovacao" }],
    });
    const [row] = await abastecimentosApi.listar("p1");
    expect(row.status).toBe("pendente");
  });

  it("calcula valor a partir de pricePerLiter quando value vem null", async () => {
    getMock.mockResolvedValue({
      data: [{ ...backendPosto, value: null, pricePerLiter: 5.5, liters: 280 }],
    });
    const [row] = await abastecimentosApi.listar("p1");
    expect(row.valor).toBe(1540);
    expect(fmtTotalAbastecimento(row)).toMatch(/R\$\s*1\.540/);
  });

  it("comboio com value null exibe rótulo Comboio, não R$ 0", async () => {
    getMock.mockResolvedValue({
      data: [
        {
          ...backendPosto,
          id: "c2",
          origin: "Comboio",
          postoId: null,
          comboioId: "comboio-1",
          value: null,
          liters: 280,
        },
      ],
    });
    const [row] = await abastecimentosApi.listar("p1");
    expect(row.origem).toBe("comboio");
    expect(fmtTotalAbastecimento(row)).toBe("Comboio");
  });

  it("posto com value null exibe Sem valor", async () => {
    getMock.mockResolvedValue({
      data: [{ ...backendPosto, value: null, pricePerLiter: null }],
    });
    const [row] = await abastecimentosApi.listar("p1");
    expect(row.origem).toBe("posto");
    expect(fmtTotalAbastecimento(row)).toBe("Sem valor");
  });
});

describe("abastecimentosApi.remover", () => {
  it("chama DELETE em /abastecimentos/item/:id", async () => {
    delMock.mockResolvedValue(undefined);
    await abastecimentosApi.remover("a1");
    expect(delMock).toHaveBeenCalledWith("/abastecimentos/item/a1");
  });
});
