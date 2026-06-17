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

import {
  osAuditoriaDevolucaoApi,
  solicitacaoParaLinhaAuditoria,
} from "./os-auditoria-devolucao";

describe("solicitacaoParaLinhaAuditoria", () => {
  it("mapeia solicitação da API para linha de auditoria", () => {
    expect(
      solicitacaoParaLinhaAuditoria({
        id: "sol-1",
        protocol: "OS-2026-001",
        equipment: "Sany",
        line: "Amarela",
        report: "Vazamento",
        workshops: ["Oficina A"],
        status: "aguardando_orcamento",
        createdAt: "2026-06-05T14:30:00.000Z",
      }),
    ).toMatchObject({
      protocolo: "OS-2026-001",
      equipamento: "Sany",
      classificacao: "Linha Amarela",
      oficina: "Oficina A",
      defeito: "Vazamento",
      valor: 0,
      status: "aguardando_orcamento",
    });
  });
});

describe("osAuditoriaDevolucaoApi", () => {
  it("listarLinhas aplica filtros de API e oficina", async () => {
    getMock.mockResolvedValue({
      data: [
        {
          id: "sol-1",
          protocol: "OS-1",
          equipment: "Eq A",
          line: "Geral",
          report: "x",
          status: "aguardando_orcamento",
          workshopIds: ["of-1"],
          workshops: ["Oficina 1"],
          createdAt: "2026-06-01T10:00:00.000Z",
        },
        {
          id: "sol-2",
          protocol: "OS-2",
          equipment: "Eq B",
          line: "Geral",
          report: "y",
          status: "aguardando_orcamento",
          workshopIds: ["of-2"],
          createdAt: "2026-06-02T10:00:00.000Z",
        },
      ],
    });

    const linhas = await osAuditoriaDevolucaoApi.listarLinhas("pref-1", {
      status: "aguardando_orcamento",
      oficinaId: "of-1",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/os/solicitacoes/pref-1?status=aguardando_orcamento",
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].protocolo).toBe("OS-1");
  });
});
