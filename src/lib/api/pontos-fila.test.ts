import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pontos", () => ({
  pontosApi: { bater: vi.fn() },
}));

import { ApiError } from "./client";
import { pontosApi, type BaterPontoInput } from "./pontos";
import { offlineDb } from "../offline/db";
import { baterComFila, pendentes, sincronizar } from "./pontos-fila";

const bater = vi.mocked(pontosApi.bater);

const input = {
  name: "Ana",
  photo: "data:,x",
  prefeituraId: "p1",
  timestampOriginal: "2026-06-12T08:00:00Z",
  tipo: "entrada",
} as BaterPontoInput;

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: v,
    configurable: true,
  });
}

beforeEach(() => {
  bater.mockReset();
  setOnline(true);
});

afterEach(async () => {
  await offlineDb.sync_queue.clear();
  localStorage.clear();
});

describe("baterComFila (outbox)", () => {
  it("online envia direto com chave de idempotência e devolve o registro", async () => {
    bater.mockResolvedValue({ id: "r1", nsr: 7 } as never);
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(true);
    expect(r.registro).toMatchObject({ nsr: 7 });
    expect(bater).toHaveBeenCalledWith(input, expect.any(String));
    expect(await pendentes()).toBe(0);
  });

  it("offline enfileira sem chamar a API", async () => {
    setOnline(false);
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    expect(bater).not.toHaveBeenCalled();
    expect(await pendentes()).toBe(1);
  });

  it("falha de rede enfileira com a MESMA chave do envio direto", async () => {
    bater.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    const chaveDireta = bater.mock.calls[0][1];
    bater.mockResolvedValue({ id: "r1" } as never);
    await sincronizar();
    expect(bater.mock.calls[1][1]).toBe(chaveDireta);
    expect(await pendentes()).toBe(0);
  });

  it("erro 5xx no envio direto enfileira com a mesma chave (proxy pode ter gravado)", async () => {
    bater.mockRejectedValueOnce(new ApiError(503, "bad gateway"));
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    expect(await pendentes()).toBe(1);
    const chaveDireta = bater.mock.calls[0][1];
    bater.mockResolvedValue({ id: "r1" } as never);
    await sincronizar();
    expect(bater.mock.calls[1][1]).toBe(chaveDireta);
    expect(await pendentes()).toBe(0);
  });

  it("erro do servidor (ApiError) propaga sem enfileirar", async () => {
    bater.mockRejectedValue(new ApiError(403, "ponto inativo"));
    await expect(baterComFila(input)).rejects.toThrow("ponto inativo");
    expect(await pendentes()).toBe(0);
  });

  it("migra a fila legada do localStorage antes de operar", async () => {
    localStorage.setItem("hu360-ponto-fila", JSON.stringify([input]));
    expect(await pendentes()).toBe(1);
    expect(localStorage.getItem("hu360-ponto-fila")).toBeNull();
  });

  it("sincronizar devolve o nº de enviadas e mantém 4xx visível", async () => {
    setOnline(false);
    await baterComFila(input);
    await baterComFila({ ...input, tipo: "saida" });
    setOnline(true);
    bater
      .mockResolvedValueOnce({ id: "r1" } as never)
      .mockRejectedValueOnce(new ApiError(400, "inválido"));
    expect(await sincronizar()).toBe(1);
    expect(await pendentes()).toBe(1);
  });
});
