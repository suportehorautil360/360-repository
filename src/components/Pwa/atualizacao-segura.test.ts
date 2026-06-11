/**
 * Coordena o auto-update do PWA: o app marca quando há trabalho em andamento
 * (checklist/emergência sendo preenchidos) e o prompt só recarrega sozinho
 * quando não há nada a perder.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetTrabalhos,
  marcarTrabalhoEmAndamento,
  podeAtualizarComSeguranca,
} from "./atualizacao-segura";

beforeEach(() => __resetTrabalhos());

describe("atualizacao-segura", () => {
  it("sem trabalho em andamento, pode atualizar", () => {
    expect(podeAtualizarComSeguranca()).toBe(true);
  });

  it("com trabalho marcado, não pode atualizar", () => {
    marcarTrabalhoEmAndamento("checklist", true);
    expect(podeAtualizarComSeguranca()).toBe(false);
  });

  it("trabalho concluído libera a atualização", () => {
    marcarTrabalhoEmAndamento("checklist", true);
    marcarTrabalhoEmAndamento("checklist", false);
    expect(podeAtualizarComSeguranca()).toBe(true);
  });

  it("origens independentes: só libera quando todas terminam", () => {
    marcarTrabalhoEmAndamento("checklist", true);
    marcarTrabalhoEmAndamento("emergencia", true);
    marcarTrabalhoEmAndamento("checklist", false);
    expect(podeAtualizarComSeguranca()).toBe(false);
    marcarTrabalhoEmAndamento("emergencia", false);
    expect(podeAtualizarComSeguranca()).toBe(true);
  });
});
