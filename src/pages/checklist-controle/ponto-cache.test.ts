/**
 * Cache last-known da folha de ponto. O histórico vem da API NestJS (fetch),
 * que não funciona offline — sem cache, a tela de ponto dava "load failed".
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  lerCachePonto,
  salvarCachePonto,
  type PontoCache,
} from "./ponto-cache";

const dados = {
  lista: [{ id: "1", tipo: "entrada" }],
  escala: { almocoMinutos: 60 },
  empresa: { nome: "Prefeitura X" },
  abonos: [{ id: "a1" }],
} as unknown as PontoCache;

beforeEach(() => localStorage.clear());

describe("ponto-cache", () => {
  it("salva e lê por prefeitura", () => {
    salvarCachePonto("pref-1", dados);
    expect(lerCachePonto("pref-1")).toEqual(dados);
  });

  it("prefeituras diferentes não se misturam", () => {
    salvarCachePonto("pref-1", dados);
    expect(lerCachePonto("pref-2")).toBeNull();
  });

  it("sem cache → null", () => {
    expect(lerCachePonto("pref-1")).toBeNull();
  });

  it("cache corrompido → null sem lançar", () => {
    localStorage.setItem("hu360-ponto-cache:pref-1", "{lixo");
    expect(lerCachePonto("pref-1")).toBeNull();
  });
});
