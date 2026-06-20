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
  it("limita a 3 oficinas compatíveis", () => {
    const r = selecionarOficinas(oficinas, "Amarela", 3);
    expect(r.length).toBe(3);
    expect(r.every((o) => o.especialidade === "Amarela")).toBe(true);
  });

  it("usa fallback quando linha não tem match", () => {
    const r = selecionarOficinas(oficinas, "Verde", 3);
    expect(r.length).toBeGreaterThan(0);
  });
});
