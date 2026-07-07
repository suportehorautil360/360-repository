import { describe, expect, it } from "vitest";
import {
  GRUPO_FROTA,
  GRUPO_MANUTENCAO,
  GRUPO_PESSOAS,
  podeAcessarGrupo,
} from "./prefeituraAcesso";

describe("podeAcessarGrupo — gating por cargo", () => {
  it("admin vê todos os grupos", () => {
    const admin = { perfil: "admin", cargo: "Operador" };
    expect(podeAcessarGrupo(GRUPO_FROTA, admin)).toBe(true);
    expect(podeAcessarGrupo(GRUPO_MANUTENCAO, admin)).toBe(true);
    expect(podeAcessarGrupo(GRUPO_PESSOAS, admin)).toBe(true);
  });

  it("gestor sem cargo (legado) vê tudo", () => {
    const legado = { perfil: "gestor" };
    expect(podeAcessarGrupo(GRUPO_FROTA, legado)).toBe(true);
    expect(podeAcessarGrupo(GRUPO_MANUTENCAO, legado)).toBe(true);
    expect(podeAcessarGrupo(GRUPO_PESSOAS, legado)).toBe(true);
  });

  it("undefined (sem acesso) libera tudo — fallback seguro p/ legado", () => {
    expect(podeAcessarGrupo(GRUPO_FROTA, undefined)).toBe(true);
  });

  it("Operador e Mecânico → só Manutenção", () => {
    for (const cargo of ["Operador", "Mecânico", "mecanico"]) {
      const u = { perfil: "gestor", cargo };
      expect(podeAcessarGrupo(GRUPO_MANUTENCAO, u)).toBe(true);
      expect(podeAcessarGrupo(GRUPO_FROTA, u)).toBe(false);
      expect(podeAcessarGrupo(GRUPO_PESSOAS, u)).toBe(false);
    }
  });

  it("Motorista e Comboista → só Gestão de Frota", () => {
    for (const cargo of ["Motorista", "Comboista"]) {
      const u = { perfil: "gestor", cargo };
      expect(podeAcessarGrupo(GRUPO_FROTA, u)).toBe(true);
      expect(podeAcessarGrupo(GRUPO_MANUTENCAO, u)).toBe(false);
      expect(podeAcessarGrupo(GRUPO_PESSOAS, u)).toBe(false);
    }
  });

  it("Supervisor → só Pessoas / RH", () => {
    const u = { perfil: "gestor", cargo: "Supervisor" };
    expect(podeAcessarGrupo(GRUPO_PESSOAS, u)).toBe(true);
    expect(podeAcessarGrupo(GRUPO_FROTA, u)).toBe(false);
    expect(podeAcessarGrupo(GRUPO_MANUTENCAO, u)).toBe(false);
  });

  it('cargo "Outro" não tem acesso operacional', () => {
    const u = { perfil: "gestor", cargo: "Outro" };
    expect(podeAcessarGrupo(GRUPO_FROTA, u)).toBe(false);
    expect(podeAcessarGrupo(GRUPO_MANUTENCAO, u)).toBe(false);
    expect(podeAcessarGrupo(GRUPO_PESSOAS, u)).toBe(false);
  });

  it("grupos base (Principal, Sistema) nunca são bloqueados", () => {
    const u = { perfil: "gestor", cargo: "Outro" };
    expect(podeAcessarGrupo("Principal", u)).toBe(true);
    expect(podeAcessarGrupo("Sistema", u)).toBe(true);
  });
});
