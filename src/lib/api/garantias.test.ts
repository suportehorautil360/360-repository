import { describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock },
  };
});

import { garantiasApi, labelStatusGarantia } from "./garantias";

describe("labelStatusGarantia", () => {
  it("traduz status da API", () => {
    expect(labelStatusGarantia("vigente")).toBe("Vigente");
    expect(labelStatusGarantia("vencendo")).toBe("Prestes a vencer");
    expect(labelStatusGarantia("vencido")).toBe("Vencido");
  });
});

describe("garantiasApi", () => {
  it("monta query e chama GET por solicitação", async () => {
    getMock.mockResolvedValueOnce({
      resumo: {
        equipamentoId: "eq-1",
        equipamento: "Sany",
        horimetroAtual: 1200,
        itensEmGarantia: 2,
        prestesAVencer: 0,
      },
      data: [],
      chdsEncontrados: 1,
      message: "ok",
    });

    await garantiasApi.listarPorSolicitacao("sol-1", {
      horimetroAtual: "1200",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/garantias/solicitacao/sol-1?horimetroAtual=1200",
    );
  });

  it("monta query e chama GET por equipamento", async () => {
    getMock.mockResolvedValueOnce({
      resumo: {
        equipamentoId: "eq-1",
        equipamento: "Sany",
        horimetroAtual: 1200,
        itensEmGarantia: 1,
        prestesAVencer: 0,
      },
      data: [],
      message: "ok",
    });

    await garantiasApi.listarPorEquipamento("eq-1", {
      horimetroAtual: "1200",
      status: "vigente",
      tipo: "peca",
      busca: "filtro",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/garantias/equipamento/eq-1?horimetroAtual=1200&status=vigente&tipo=peca&busca=filtro",
    );
  });
});
