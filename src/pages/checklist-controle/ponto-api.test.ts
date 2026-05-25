import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));
vi.mock("../../lib/api/client", () => ({
  api: { get: getMock, post: postMock },
}));

import { pontoApi } from "./ponto-api";

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe("pontoApi.bater", () => {
  it("faz POST em /time-records e devolve o registro", async () => {
    const reg = {
      id: "t1",
      name: "João",
      prefeituraId: "pref-1",
      timestampOriginal: "2026-05-25T13:05:00.000Z",
    };
    postMock.mockResolvedValue({ data: reg, message: "ok" });

    const r = await pontoApi.bater({
      name: "João",
      photo: "data:image/jpeg;base64,abc",
      prefeituraId: "pref-1",
      timestampOriginal: "2026-05-25T13:05:00.000Z",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/time-records",
      expect.objectContaining({ name: "João", prefeituraId: "pref-1" }),
    );
    expect(r).toEqual(reg);
  });
});

describe("pontoApi.listar", () => {
  it("faz GET por prefeitura e devolve a lista", async () => {
    getMock.mockResolvedValue({
      data: [{ id: "t1", name: "João" }],
      message: "ok",
    });

    const lista = await pontoApi.listar("pref-1");

    expect(getMock).toHaveBeenCalledWith("/time-records/pref-1");
    expect(lista).toHaveLength(1);
    expect(lista[0].name).toBe("João");
  });
});
