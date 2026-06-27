import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { offlineDb } from "./db";
import { contarPendentes } from "./outbox";
import { migrarFilaLegadaPonto } from "./migrar-fila-ponto";

afterEach(async () => {
  await offlineDb.sync_queue.clear();
  localStorage.clear();
});

describe("migrarFilaLegadaPonto", () => {
  it("importa as batidas da fila localStorage e limpa a chave", async () => {
    localStorage.setItem(
      "hu360-ponto-fila",
      JSON.stringify([
        { name: "Ana", tipo: "entrada" },
        { name: "Ana", tipo: "saida" },
      ]),
    );
    const n = await migrarFilaLegadaPonto();
    expect(n).toBe(2);
    expect(await contarPendentes("ponto")).toBe(2);
    expect(localStorage.getItem("hu360-ponto-fila")).toBeNull();
  });

  it("sem fila legada não faz nada", async () => {
    expect(await migrarFilaLegadaPonto()).toBe(0);
    expect(await contarPendentes()).toBe(0);
  });

  it("fila corrompida não explode e a chave é removida", async () => {
    localStorage.setItem("hu360-ponto-fila", "{lixo");
    expect(await migrarFilaLegadaPonto()).toBe(0);
    expect(localStorage.getItem("hu360-ponto-fila")).toBeNull();
  });

  it("JSON válido que não é array → 0, nada enfileirado, chave removida", async () => {
    localStorage.setItem("hu360-ponto-fila", '{"a":1}');
    expect(await migrarFilaLegadaPonto()).toBe(0);
    expect(await contarPendentes()).toBe(0);
    expect(localStorage.getItem("hu360-ponto-fila")).toBeNull();
  });

  it("string JSON (iterável!) não vira um item por caractere", async () => {
    localStorage.setItem("hu360-ponto-fila", '"abc"');
    expect(await migrarFilaLegadaPonto()).toBe(0);
    expect(await contarPendentes()).toBe(0);
  });

  it("reexecução com o mesmo conteúdo é idempotente (nunca batida dupla)", async () => {
    const fila = JSON.stringify([
      { name: "Ana", tipo: "entrada" },
      { name: "Ana", tipo: "saida" },
    ]);
    localStorage.setItem("hu360-ponto-fila", fila);
    expect(await migrarFilaLegadaPonto()).toBe(2);
    // Boot interrompido: a chave "volta" com o mesmo conteúdo.
    localStorage.setItem("hu360-ponto-fila", fila);
    expect(await migrarFilaLegadaPonto()).toBe(0);
    expect(await contarPendentes("ponto")).toBe(2);
  });

  it("retry parcial importa só o que falta", async () => {
    const duas = [
      { name: "Ana", tipo: "entrada" },
      { name: "Ana", tipo: "saida" },
    ];
    localStorage.setItem("hu360-ponto-fila", JSON.stringify(duas));
    expect(await migrarFilaLegadaPonto()).toBe(2);
    // Mesmas duas batidas + uma nova: só a nova conta.
    localStorage.setItem(
      "hu360-ponto-fila",
      JSON.stringify([...duas, { name: "Bia", tipo: "entrada" }]),
    );
    expect(await migrarFilaLegadaPonto()).toBe(1);
    expect(await contarPendentes("ponto")).toBe(3);
  });
});
