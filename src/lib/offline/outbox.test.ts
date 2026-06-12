import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { offlineDb } from "./db";
import {
  contarPendentes,
  concluir,
  enfileirar,
  listarDevidos,
  marcarAtencao,
  marcarEnviando,
  recuperarPresos,
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

  it("rejeita id duplicado sem sobrescrever o item original", async () => {
    await enfileirar("ponto", { n: 1 }, "dup");
    await expect(enfileirar("ponto", { n: 2 }, "dup")).rejects.toThrow();
    const salvo = await offlineDb.sync_queue.get("dup");
    expect(salvo?.payload).toEqual({ n: 1 });
    expect(await contarPendentes()).toBe(1);
  });

  it("item recém-enfileirado é devido imediatamente, mesmo em rajada", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const item = await enfileirar("ponto", { n: i });
      ids.push(item.id);
    }
    const devidos = await listarDevidos();
    expect(devidos.map((i) => i.id)).toEqual(ids);
  });

  it("listarDevidos respeita a ordem de criação e o backoff", async () => {
    const a = await enfileirar("ponto", { n: 1 });
    const b = await enfileirar("ponto", { n: 2 });
    expect((await listarDevidos()).map((i) => i.id)).toEqual([a.id, b.id]);
    await marcarEnviando(a.id);
    await registrarFalha(a.id, "rede caiu");
    expect((await listarDevidos()).map((i) => i.id)).toEqual([b.id]);
    const depois = new Date(Date.now() + 60 * 60_000);
    expect((await listarDevidos(depois)).length).toBe(2);
  });

  it("listarDevidos não inclui itens SENDING", async () => {
    const a = await enfileirar("ponto", {});
    const b = await enfileirar("ponto", {});
    await marcarEnviando(a.id);
    expect((await listarDevidos()).map((i) => i.id)).toEqual([b.id]);
  });

  it("marcarEnviando é um claim atômico: só a primeira chamada vence", async () => {
    const a = await enfileirar("ponto", {});
    expect(await marcarEnviando(a.id)).toBe(true);
    expect(await marcarEnviando(a.id)).toBe(false);
    expect((await offlineDb.sync_queue.get(a.id))?.status).toBe("SENDING");
  });

  it("registrarFalha incrementa retryCount e guarda o motivo", async () => {
    const a = await enfileirar("ponto", {});
    await marcarEnviando(a.id);
    await registrarFalha(a.id, "timeout");
    const salvo = await offlineDb.sync_queue.get(a.id);
    expect(salvo?.retryCount).toBe(1);
    expect(salvo?.lastError).toBe("timeout");
    expect(salvo?.status).toBe("PENDING");
  });

  it("backoff dobra a cada falha e respeita o teto de 30 min", async () => {
    const a = await enfileirar("ponto", {});

    await marcarEnviando(a.id);
    await registrarFalha(a.id, "falha 1");
    await marcarEnviando(a.id);
    await registrarFalha(a.id, "falha 2");
    let salvo = await offlineDb.sync_queue.get(a.id);
    const espera2 = new Date(salvo!.proximaTentativaEm).getTime() - Date.now();
    expect(espera2).toBeGreaterThan(55_000);
    expect(espera2).toBeLessThanOrEqual(65_000);

    for (let i = 3; i <= 12; i++) {
      await marcarEnviando(a.id);
      await registrarFalha(a.id, `falha ${i}`);
    }
    salvo = await offlineDb.sync_queue.get(a.id);
    expect(salvo?.retryCount).toBe(12);
    const esperaTeto = new Date(salvo!.proximaTentativaEm).getTime() - Date.now();
    expect(esperaTeto).toBeLessThanOrEqual(30 * 60_000 + 2_000);
    expect(esperaTeto).toBeGreaterThan(29 * 60_000);
  });

  it("registrarFalha em id inexistente não faz nada", async () => {
    await expect(registrarFalha("nao-existe", "x")).resolves.toBeUndefined();
    expect(await contarPendentes()).toBe(0);
  });

  it("registrarFalha não ressuscita item NEEDS_ATTENTION", async () => {
    const a = await enfileirar("ponto", {});
    await marcarEnviando(a.id);
    await marcarAtencao(a.id, "payload inválido");
    await registrarFalha(a.id, "timeout tardio");
    const salvo = await offlineDb.sync_queue.get(a.id);
    expect(salvo?.status).toBe("NEEDS_ATTENTION");
    expect(salvo?.retryCount).toBe(0);
    expect(salvo?.lastError).toBe("payload inválido");
  });

  it("marcarAtencao só atua em item reivindicado (SENDING)", async () => {
    const a = await enfileirar("ponto", {});
    await marcarAtencao(a.id, "fora de hora");
    expect((await offlineDb.sync_queue.get(a.id))?.status).toBe("PENDING");
  });

  it("marcarAtencao tira da fila de envio mas mantém visível", async () => {
    const a = await enfileirar("ponto", {});
    await marcarEnviando(a.id);
    await marcarAtencao(a.id, "payload inválido");
    expect(await listarDevidos()).toEqual([]);
    expect(await contarPendentes("ponto")).toBe(1);
    expect((await offlineDb.sync_queue.get(a.id))?.status).toBe("NEEDS_ATTENTION");
  });

  it("recuperarPresos devolve SENDING para PENDING e o item volta a ser devido", async () => {
    const a = await enfileirar("ponto", {});
    await marcarEnviando(a.id);
    await registrarFalha(a.id, "timeout");
    await marcarEnviando(a.id); // simula crash no meio do envio
    expect(await recuperarPresos()).toBe(1);
    const salvo = await offlineDb.sync_queue.get(a.id);
    expect(salvo?.status).toBe("PENDING");
    expect(salvo?.retryCount).toBe(1);
    expect(salvo?.lastError).toBe("timeout");
    expect((await listarDevidos()).map((i) => i.id)).toEqual([a.id]);
  });

  it("concluir remove o item", async () => {
    const a = await enfileirar("ponto", {});
    await concluir(a.id);
    expect(await contarPendentes()).toBe(0);
  });
});
