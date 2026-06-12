/**
 * Contador de checklists/emergências salvos offline e ainda não confirmados
 * pelo servidor. Diferente do ponto (fila própria), estes são escritos pelo
 * SDK do Firestore — então mantemos uma contagem própria, reconciliada com o
 * waitForPendingWrites do SDK ao reabrir o app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  contarPendentes,
  lerPendentes,
  marcarPendente,
  removerPendente,
  removerVarios,
} from "./sync-pendencias";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("sync-pendencias", () => {
  it("marca e conta pendências por tipo", () => {
    marcarPendente("c1", "checklist");
    marcarPendente("e1", "emergencia");
    expect(contarPendentes()).toBe(2);
    expect(lerPendentes().map((p) => p.id)).toEqual(["c1", "e1"]);
  });

  it("não duplica o mesmo id", () => {
    marcarPendente("c1", "checklist");
    marcarPendente("c1", "checklist");
    expect(contarPendentes()).toBe(1);
  });

  it("remover baixa a contagem (a escrita confirmou)", () => {
    marcarPendente("c1", "checklist");
    marcarPendente("c2", "checklist");
    removerPendente("c1");
    expect(contarPendentes()).toBe(1);
    expect(lerPendentes().map((p) => p.id)).toEqual(["c2"]);
  });

  it("removerVarios limpa um conjunto sem afetar os de fora", () => {
    marcarPendente("c1", "checklist");
    marcarPendente("c2", "checklist");
    marcarPendente("c3", "checklist");
    removerVarios(["c1", "c3"]);
    expect(lerPendentes().map((p) => p.id)).toEqual(["c2"]);
  });

  it("dispara evento ao mudar (pro badge re-renderizar)", () => {
    const ouvinte = vi.fn();
    window.addEventListener("hu360-sync-pendencias", ouvinte);
    marcarPendente("c1", "checklist");
    removerPendente("c1");
    window.removeEventListener("hu360-sync-pendencias", ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });

  it("storage corrompido → conta zero sem quebrar", () => {
    localStorage.setItem("hu360-sync-pendentes", "{lixo");
    expect(contarPendentes()).toBe(0);
  });
});
