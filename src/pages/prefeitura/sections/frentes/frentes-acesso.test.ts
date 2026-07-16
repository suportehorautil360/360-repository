import { describe, expect, it } from "vitest";
import { podeVerFrente } from "./frentes-acesso";

const FRENTE = { responsavelId: "user-1" };
/** Criada antes do campo existir — sem responsável vinculado. */
const FRENTE_LEGADA = { responsavelId: "" };

describe("podeVerFrente — visibilidade por responsável", () => {
  it("admin vê frentes de qualquer responsável", () => {
    expect(podeVerFrente(FRENTE, { id: "outro", perfil: "admin" })).toBe(true);
  });

  it("o responsável vê a frente dele", () => {
    expect(podeVerFrente(FRENTE, { id: "user-1", perfil: "gestor" })).toBe(true);
  });

  it("outro usuário da prefeitura não vê a frente", () => {
    expect(podeVerFrente(FRENTE, { id: "user-2", perfil: "gestor" })).toBe(
      false,
    );
  });

  it("frente legada (sem responsável) fica visível a todos", () => {
    expect(podeVerFrente(FRENTE_LEGADA, { id: "user-2", perfil: "gestor" })).toBe(
      true,
    );
  });

  it("sessão ausente não enxerga frente com responsável", () => {
    expect(podeVerFrente(FRENTE, undefined)).toBe(false);
  });

  it("sessão sem id não casa com responsável vazio por acidente", () => {
    expect(podeVerFrente(FRENTE, { perfil: "gestor" })).toBe(false);
  });
});
