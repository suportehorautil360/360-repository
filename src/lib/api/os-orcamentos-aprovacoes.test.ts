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
  it("listarCards usa GET com-orcamentos e mapeia orçamentos", async () => {
    getMock.mockResolvedValue({
      data: [
        {
          id: "sol-1",
          protocolo: "OS-2026-004",
          equipamento: "Escavadeira",
          status: "em_orcamento",
          oficinasIds: ["of-1", "of-2", "of-3"],
          invitedCount: 3,
          quotesReceived: 1,
          orcamentos: [
            {
              id: "ord-1",
              protocolo: "OS-2026-004",
              oficinaNome: "Mecânica Silva",
              valorTotal: 570,
              itens: [{ descricao: "Kit reparo", valor: 420 }],
              status: "em_pregao",
              prazoDias: 7,
            },
          ],
        },
      ],
    });

    const cards = await osOrcamentosAprovacoesApi.listarCards("pref-1");
    expect(getMock).toHaveBeenCalledWith(
      "/os/solicitacoes/pref-1/com-orcamentos",
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].solicitacao).toMatchObject({
      protocolo: "OS-2026-004",
      convidadas: 3,
    });
    expect(cards[0].ordens).toHaveLength(1);
    expect(cards[0].ordens[0]).toMatchObject({
      oficinaNome: "Mecânica Silva",
      valorTotal: 570,
      status: "em_pregao",
    });
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
  it("mapeia orçamento EN/PT para tabela", () => {
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
