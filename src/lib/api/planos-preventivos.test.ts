import { describe, expect, it, vi } from "vitest";

const { getMock, putMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("./client", async (orig) => {
  const actual = await orig<typeof import("./client")>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock, put: putMock, post: postMock },
  };
});

import { planosPreventivosApi } from "./planos-preventivos";
import { ApiError } from "./client";
import { clonarMatrizPadrao } from "../../pages/prefeitura/sections/plano-preventivo-model";

describe("planosPreventivosApi", () => {
  it("obter retorna null em 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "Not found"));
    await expect(planosPreventivosApi.obter("pref-1")).resolves.toBeNull();
  });

  it("salvar envia ciclos e linhas", async () => {
    const matriz = clonarMatrizPadrao();
    putMock.mockResolvedValue({
      data: { prefeituraId: "pref-1", ...matriz },
    });
    await planosPreventivosApi.salvar("pref-1", matriz);
    expect(putMock).toHaveBeenCalledWith("/planos-preventivos/pref-1", {
      ciclos: matriz.ciclos,
      linhas: matriz.linhas,
    });
  });

  it("restaurarPadrao chama POST", async () => {
    const matriz = clonarMatrizPadrao();
    postMock.mockResolvedValue({
      data: { prefeituraId: "pref-1", ...matriz },
    });
    await planosPreventivosApi.restaurarPadrao("pref-1");
    expect(postMock).toHaveBeenCalledWith(
      "/planos-preventivos/pref-1/restaurar-padrao",
    );
  });
});
