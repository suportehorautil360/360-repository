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

  it("fila corrompida não explode", async () => {
    localStorage.setItem("hu360-ponto-fila", "{lixo");
    expect(await migrarFilaLegadaPonto()).toBe(0);
  });
});
