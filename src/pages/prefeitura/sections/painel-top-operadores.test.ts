import { describe, expect, it } from "vitest";
import { topOperadoresParaGrafico } from "./painel-top-operadores";

describe("painel-top-operadores", () => {
  it("mapeia para o gráfico horizontal", () => {
    expect(
      topOperadoresParaGrafico([{ nome: "Maria Silva Santos", total: 4 }]),
    ).toEqual([{ label: "Maria Silva Santos", valor: 4 }]);
  });
});
