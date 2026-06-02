import { describe, expect, it } from "vitest";
import { registroDoOperador } from "./registro-operador";
import type { OperadorSession } from "./useOperadorSession";

function sess(p: Partial<OperadorSession>): OperadorSession {
  return {
    nome: "Edmar Barbosa dos Santos",
    idCliente: "pref-1",
    empresa: "",
    funcionarioId: "func-edmar",
    tipo: "operador",
    ...p,
  };
}

describe("registroDoOperador", () => {
  it("casa por funcionarioId quando o registro tem o campo", () => {
    const s = sess({});
    expect(registroDoOperador({ funcionarioId: "func-edmar" }, s)).toBe(true);
    expect(registroDoOperador({ funcionarioId: "func-jeff" }, s)).toBe(false);
  });

  it("registro legado (sem funcionarioId) casa pelo nome do operador", () => {
    const s = sess({});
    expect(
      registroDoOperador({ operador: "Edmar Barbosa dos Santos" }, s),
    ).toBe(true);
    expect(registroDoOperador({ operador: "Jefferson Lima" }, s)).toBe(false);
    // aceita a chave legada `Operador` (linha do histórico)
    expect(registroDoOperador({ Operador: "edmar barbosa dos santos" }, s)).toBe(
      true,
    );
  });

  it("supervisor e admin enxergam tudo (não filtra)", () => {
    expect(
      registroDoOperador({ funcionarioId: "outro" }, sess({ tipo: "supervisor" })),
    ).toBe(true);
    expect(
      registroDoOperador({ funcionarioId: "outro" }, sess({ tipo: "admin" })),
    ).toBe(true);
  });

  it("sem funcionarioId na sessão, usa o nome", () => {
    const s = sess({ funcionarioId: undefined });
    expect(
      registroDoOperador(
        { funcionarioId: "qualquer", operador: "Edmar Barbosa dos Santos" },
        s,
      ),
    ).toBe(true);
  });
});
