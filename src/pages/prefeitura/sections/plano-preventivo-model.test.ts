import { describe, expect, it } from "vitest";
import {
  clonarMatrizPadrao,
  montarRelatoPreventivo,
} from "./plano-preventivo-model";

describe("montarRelatoPreventivo", () => {
  it("lista itens com ação diferente de na no ciclo", () => {
    const matriz = clonarMatrizPadrao();
    const relato = montarRelatoPreventivo(matriz, "c1");

    expect(relato).toMatch(/^Manutenção preventiva — Ciclo 1/);
    expect(relato).toContain("• Fluidos — Óleo do Motor:");
    expect(relato).toContain("• Filtros — Filtro de Óleo do Motor: Trocar");
  });

  it("retorna vazio se ciclo inexistente", () => {
    expect(montarRelatoPreventivo(clonarMatrizPadrao(), "c99")).toBe("");
  });
});
