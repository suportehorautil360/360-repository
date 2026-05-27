import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pontos", () => ({ pontosApi: { bater: vi.fn() } }));

import { pontosApi } from "./pontos";
import { ApiError } from "./client";
import { baterComFila, pendentes, sincronizar } from "./pontos-fila";

const bater = vi.mocked(pontosApi.bater);

const input = {
  name: "x",
  photo: "data:image/jpeg;base64,abc",
  prefeituraId: "p",
  timestampOriginal: "2026-05-26T11:00:00.000Z",
  tipo: "entrada" as const,
};

const reg = { id: "1", ...input };

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

beforeEach(() => {
  localStorage.clear();
  bater.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("baterComFila", () => {
  it("online: envia direto e não enfileira", async () => {
    setOnline(true);
    bater.mockResolvedValue(reg);
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(true);
    expect(pendentes()).toBe(0);
    expect(bater).toHaveBeenCalledTimes(1);
  });

  it("offline: enfileira sem chamar a API", async () => {
    setOnline(false);
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    expect(pendentes()).toBe(1);
    expect(bater).not.toHaveBeenCalled();
  });

  it("falha de rede (não-ApiError): enfileira", async () => {
    setOnline(true);
    bater.mockRejectedValue(new TypeError("network"));
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    expect(pendentes()).toBe(1);
  });

  it("erro do servidor (ApiError): propaga e não enfileira", async () => {
    setOnline(true);
    bater.mockRejectedValue(new ApiError(400, "ruim"));
    await expect(baterComFila(input)).rejects.toThrow("ruim");
    expect(pendentes()).toBe(0);
  });
});

describe("sincronizar", () => {
  it("reenvia a fila e limpa ao ter sucesso", async () => {
    setOnline(false);
    await baterComFila(input);
    expect(pendentes()).toBe(1);

    setOnline(true);
    bater.mockResolvedValue(reg);
    const n = await sincronizar();
    expect(n).toBe(1);
    expect(pendentes()).toBe(0);
  });
});
