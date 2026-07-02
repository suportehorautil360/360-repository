import { describe, expect, it } from "vitest";
import {
  linhaCompat,
  normEsp,
  selecionarOficinas,
  type OficinaAtiva,
} from "./criar-solicitacao-os";

const oficinas: OficinaAtiva[] = [
  { id: "1", nome: "A", especialidade: "Amarela" },
  { id: "2", nome: "B", especialidade: "Amarela" },
  { id: "3", nome: "C", especialidade: "Amarela" },
  { id: "4", nome: "D", especialidade: "Amarela" },
  { id: "5", nome: "E", especialidade: "Pesada" },
];

describe("normEsp / linhaCompat", () => {
  it("aceita includes bidirecional", () => {
    expect(linhaCompat("Linha Amarela", "Amarela")).toBe(true);
    expect(normEsp("Linha Amarela")).toBe("linha amarela");
  });
});

describe("selecionarOficinas", () => {
  it("sem max retorna todas as compatíveis", () => {
    const r = selecionarOficinas(oficinas, "Amarela");
    expect(r.length).toBe(4);
    expect(r.every((o) => o.especialidade === "Amarela")).toBe(true);
  });

  it("com max limita o pool", () => {
    const r = selecionarOficinas(oficinas, "Amarela", 2);
    expect(r.length).toBe(2);
  });

  it("retorna vazio quando linha não tem match", () => {
    expect(selecionarOficinas(oficinas, "Verde", 3)).toEqual([]);
  });
});
