import { describe, expect, it, vi } from "vitest";

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock, patch: patchMock },
  };
});

import {
  mensagemErroAprovarOrcamento,
  osOrcamentosAprovacoesApi,
  quoteApiParaOrdem,
} from "./os-orcamentos-aprovacoes";
import { ApiError } from "./client";

describe("osOrcamentosAprovacoesApi", () => {
  it("listarCards usa GET /os/solicitacoes e mapeia campos EN/PT", async () => {
    getMock.mockResolvedValue({
      data: [
        {
          id: "sol-1",
          protocol: "OS-2026-001",
          equipment: "Sany SYL956H",
          line: "Amarela",
          operator: "João Silva",
          report: "Vazamento",
          status: "aguardando_orcamento",
          workshops: ["Oficina A"],
          workshopIds: ["uuid-oficina"],
          createdAt: "2026-06-05T14:30:00.000Z",
        },
      ],
    });

    const cards = await osOrcamentosAprovacoesApi.listarCards("pref-1");
    expect(getMock).toHaveBeenCalledWith("/os/solicitacoes/pref-1");
    expect(cards).toHaveLength(1);
    expect(cards[0].solicitacao).toMatchObject({
      protocolo: "OS-2026-001",
      equipamento: "Sany SYL956H",
      relato: "Vazamento",
      oficinas: ["Oficina A"],
      oficinasIds: ["uuid-oficina"],
    });
    expect(cards[0].ordens).toEqual([]);
  });

  it("aprovar envia PATCH com ordemServicoId", async () => {
    patchMock.mockResolvedValue(undefined);
    await osOrcamentosAprovacoesApi.aprovar("sol-1", "ord-1");
    expect(patchMock).toHaveBeenCalledWith(
      "/os/solicitacoes/sol-1/aprovar",
      { ordemServicoId: "ord-1" },
    );
  });
});

describe("quoteApiParaOrdem", () => {
  it("mapeia orçamento para tabela (API futura)", () => {
    expect(
      quoteApiParaOrdem(
        {
          id: "ord-1",
          protocol: "ORC-047-A",
          workshopName: "Avantec",
          defect: "defeito",
          totalValue: 6000,
          status: "aguardando_aprovacao",
          items: [{ description: "Mão de obra", value: 6000 }],
        },
        "sol-1",
      ),
    ).toMatchObject({
      protocolo: "ORC-047-A",
      oficinaNome: "Avantec",
      valorTotal: 6000,
      solicitacaoOsId: "sol-1",
    });
  });
});

describe("mensagemErroAprovarOrcamento", () => {
  it("mapeia status HTTP", () => {
    expect(mensagemErroAprovarOrcamento(new ApiError(409, "x"))).toContain(
      "aprovada",
    );
    expect(mensagemErroAprovarOrcamento(new ApiError(404, "x"))).toContain(
      "encontrado",
    );
  });
});
