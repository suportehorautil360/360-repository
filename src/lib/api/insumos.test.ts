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

import { insumosApi } from "./insumos";

describe("insumosApi", () => {
  it("chama GET por solicitação", async () => {
    getMock.mockResolvedValueOnce({
      resumo: {
        totalItens: 1,
        valorTotal: 100,
        orcamentosEncontrados: 1,
      },
      data: [],
      message: "ok",
    });

    await insumosApi.listarPorSolicitacao("sol-1");

    expect(getMock).toHaveBeenCalledWith("/insumos/solicitacao/sol-1");
  });
});
