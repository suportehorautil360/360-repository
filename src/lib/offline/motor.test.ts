import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { offlineDb } from "./db";
import { contarPendentes, enfileirar } from "./outbox";
import { processarFila, registrarEnviador } from "./motor";

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: v,
    configurable: true,
  });
}

afterEach(async () => {
  await offlineDb.sync_queue.clear();
  setOnline(true);
});

describe("processarFila", () => {
  it("envia os itens devidos e remove da fila", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    registrarEnviador("teste-ok", enviar);
    await enfileirar("teste-ok", { n: 1 });
    await enfileirar("teste-ok", { n: 2 });
    const r = await processarFila();
    expect(r.enviados).toBe(2);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(await contarPendentes()).toBe(0);
  });

  it("offline não tenta nada", async () => {
    setOnline(false);
    const enviar = vi.fn();
    registrarEnviador("teste-off", enviar);
    await enfileirar("teste-off", {});
    const r = await processarFila();
    expect(r).toEqual({ enviados: 0, falhas: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("erro transitório (rede/5xx) mantém PENDING com backoff", async () => {
    registrarEnviador("teste-5xx", vi.fn().mockRejectedValue(new ApiError(500, "erro")));
    const item = await enfileirar("teste-5xx", {});
    const r = await processarFila();
    expect(r.falhas).toBe(1);
    const salvo = await offlineDb.sync_queue.get(item.id);
    expect(salvo?.status).toBe("PENDING");
    expect(salvo?.retryCount).toBe(1);
  });

  it("erro definitivo (4xx) vira NEEDS_ATTENTION — nunca descarta", async () => {
    registrarEnviador("teste-4xx", vi.fn().mockRejectedValue(new ApiError(400, "inválido")));
    const item = await enfileirar("teste-4xx", {});
    const r = await processarFila();
    expect(r.falhas).toBe(1);
    const salvo = await offlineDb.sync_queue.get(item.id);
    expect(salvo?.status).toBe("NEEDS_ATTENTION");
    expect(salvo?.lastError).toBe("inválido");
  });

  it("408 e 429 são transitórios, não NEEDS_ATTENTION", async () => {
    registrarEnviador("teste-429", vi.fn().mockRejectedValue(new ApiError(429, "calma")));
    const item429 = await enfileirar("teste-429", {});
    registrarEnviador("teste-408", vi.fn().mockRejectedValue(new ApiError(408, "timeout")));
    const item408 = await enfileirar("teste-408", {});
    await processarFila();
    expect((await offlineDb.sync_queue.get(item429.id))?.status).toBe("PENDING");
    expect((await offlineDb.sync_queue.get(item408.id))?.status).toBe("PENDING");
  });

  it("falha que não é ApiError (rede) é transitória", async () => {
    registrarEnviador(
      "teste-rede",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const item = await enfileirar("teste-rede", {});
    const r = await processarFila();
    expect(r.falhas).toBe(1);
    const salvo = await offlineDb.sync_queue.get(item.id);
    expect(salvo?.status).toBe("PENDING");
    expect(salvo?.retryCount).toBe(1);
  });

  it("falha em um item não impede o envio dos demais", async () => {
    const enviar = vi.fn().mockImplementation(async (item) => {
      if ((item.payload as { n: number }).n === 1) {
        throw new ApiError(500, "erro");
      }
    });
    registrarEnviador("teste-parcial", enviar);
    await enfileirar("teste-parcial", { n: 1 });
    await enfileirar("teste-parcial", { n: 2 });
    const r = await processarFila();
    expect(r).toEqual({ enviados: 1, falhas: 1 });
    expect(await contarPendentes()).toBe(1);
  });

  it("chamadas sobrepostas compartilham o mesmo ciclo", async () => {
    let liberar!: () => void;
    const segura = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const enviar = vi.fn().mockImplementation(() => segura);
    registrarEnviador("teste-reentrante", enviar);
    await enfileirar("teste-reentrante", {});
    // Online + intervalo + mount disparam juntos: deve haver um ciclo só.
    const p1 = processarFila();
    const p2 = processarFila();
    expect(p1).toBe(p2);
    liberar();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
    expect(r1).toEqual({ enviados: 1, falhas: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("entidade sem enviador registrado fica na fila", async () => {
    await enfileirar("desconhecida", {});
    const r = await processarFila();
    expect(r).toEqual({ enviados: 0, falhas: 0 });
    expect(await contarPendentes()).toBe(1);
  });

  it("item preso em SENDING (crash anterior) é recuperado e enviado", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    registrarEnviador("teste-preso", enviar);
    const item = await enfileirar("teste-preso", {});
    await offlineDb.sync_queue.update(item.id, { status: "SENDING" });
    const r = await processarFila();
    expect(r.enviados).toBe(1);
    expect(await contarPendentes()).toBe(0);
  });

  it("item fora de PENDING não é enviado nem conta como falha", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    registrarEnviador("teste-claim", enviar);
    const item = await enfileirar("teste-claim", {});
    // Simula outra aba vencendo a disputa antes deste ciclo.
    await offlineDb.sync_queue.update(item.id, { status: "NEEDS_ATTENTION" });
    const r = await processarFila();
    expect(enviar).not.toHaveBeenCalled();
    expect(r).toEqual({ enviados: 0, falhas: 0 });
  });
});
