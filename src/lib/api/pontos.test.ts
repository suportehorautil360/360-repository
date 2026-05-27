import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));
vi.mock("./client", () => ({ api: { get: getMock, post: postMock } }));

import { pontosApi } from "./pontos";

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  postMock.mockResolvedValue({ data: {}, message: "ok" });
});

describe("pontosApi RH", () => {
  it("aprovar faz POST em /time-records/:id/aprovar", async () => {
    await pontosApi.aprovar("t1");
    expect(postMock).toHaveBeenCalledWith("/time-records/t1/aprovar");
  });

  it("reprovar faz POST com o motivo", async () => {
    await pontosApi.reprovar("t1", "Foto não confere");
    expect(postMock).toHaveBeenCalledWith("/time-records/t1/reprovar", {
      motivo: "Foto não confere",
    });
  });

  it("listar devolve a lista de registros", async () => {
    getMock.mockResolvedValue({
      data: [{ id: "t1", name: "João", tipo: "entrada", status: "pendente" }],
      message: "ok",
    });
    const lista = await pontosApi.listar("pref-1");
    expect(getMock).toHaveBeenCalledWith("/time-records/pref-1");
    expect(lista[0].status).toBe("pendente");
  });
});
