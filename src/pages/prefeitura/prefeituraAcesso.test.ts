/**
 * Testes canônicos em `src/lib/acesso/cargos-permissao.test.ts`.
 * Este arquivo só garante o re-export legado de `prefeituraAcesso`.
 */
import { describe, expect, it } from "vitest";
import {
  GRUPO_MANUTENCAO,
  podeAcessarGrupo,
} from "./prefeituraAcesso";

describe("prefeituraAcesso re-export", () => {
  it("expõe podeAcessarGrupo com defaults", () => {
    expect(
      podeAcessarGrupo(GRUPO_MANUTENCAO, {
        perfil: "gestor",
        cargo: "Operador",
      }),
    ).toBe(true);
  });
});
