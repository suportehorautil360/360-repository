import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { offlineDb } from "./db";
import {
  contarPendentes,
  concluir,
  enfileirar,
  listarDevidos,
  marcarAtencao,
  registrarFalha,
} from "./outbox";

afterEach(async () => {
  await offlineDb.sync_queue.clear();
});

describe("outbox", () => {
  it("enfileira com status PENDING e id próprio", async () => {
    const item = await enfileirar("ponto", { a: 1 });
    expect(item.status).toBe("PENDING");
    expect(item.id).toBeTruthy();
    expect(await contarPendentes("ponto")).toBe(1);
  });

  it("aceita id externo (chave de idempotência preservada)", async () => {
    const item = await enfileirar("ponto", { a: 1 }, "id-fixo");
    expect(item.id).toBe("id-fixo");
  });

  it("listarDevidos respeita a ordem de criação e o backoff", async () => {
    const a = await enfileirar("ponto", { n: 1 });
    const b = await enfileirar("ponto", { n: 2 });
    expect((await listarDevidos()).map((i) => i.id)).toEqual([a.id, b.id]);
    await registrarFalha(a.id, "rede caiu");
    expect((await listarDevidos()).map((i) => i.id)).toEqual([b.id]);
    const depois = new Date(Date.now() + 60 * 60_000);
    expect((await listarDevidos(depois)).length).toBe(2);
  });

  it("registrarFalha incrementa retryCount e guarda o motivo", async () => {
    const a = await enfileirar("ponto", {});
    await registrarFalha(a.id, "timeout");
    const salvo = await offlineDb.sync_queue.get(a.id);
    expect(salvo?.retryCount).toBe(1);
    expect(salvo?.lastError).toBe("timeout");
    expect(salvo?.status).toBe("PENDING");
  });

  it("marcarAtencao tira da fila de envio mas mantém visível", async () => {
    const a = await enfileirar("ponto", {});
    await marcarAtencao(a.id, "payload inválido");
    expect(await listarDevidos()).toEqual([]);
    expect(await contarPendentes("ponto")).toBe(1);
    expect((await offlineDb.sync_queue.get(a.id))?.status).toBe("NEEDS_ATTENTION");
  });

  it("concluir remove o item", async () => {
    const a = await enfileirar("ponto", {});
    await concluir(a.id);
    expect(await contarPendentes()).toBe(0);
  });
});
