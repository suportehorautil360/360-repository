import { describe, expect, it } from "vitest";
import { montarOperadorAssinatura } from "./assinatura";
import type { OperadorSession } from "./useOperadorSession";

describe("montarOperadorAssinatura", () => {
  it("modo chassi → tipo chassi + nomeInformado + chassiUsado", () => {
    const session: OperadorSession = {
      modoLogin: "chassi",
      nome: "Anon",
      idCliente: "e",
      empresa: "E",
      nomeInformado: "João",
      chassis: "ABC",
      idMaquina: "m1",
    };
    const out = montarOperadorAssinatura(session);
    expect(out).toEqual({
      tipo: "chassi",
      nomeInformado: "João",
      chassiUsado: "ABC",
      idMaquina: "m1",
    });
  });

  it("modo cpf-senha → tipo funcionario", () => {
    const session: OperadorSession = {
      modoLogin: "cpf-senha",
      nome: "Maria",
      idCliente: "e",
      empresa: "E",
      funcionarioId: "f1",
      cpf: "123",
    };
    const out = montarOperadorAssinatura(session);
    expect(out).toEqual({
      tipo: "funcionario",
      funcionarioId: "f1",
      nome: "Maria",
      cpf: "123",
    });
  });

  it("nome digitado sobrescreve o da sessão", () => {
    const session: OperadorSession = {
      modoLogin: "cpf-senha",
      nome: "Maria",
      idCliente: "e",
      empresa: "E",
      funcionarioId: "f1",
    };
    const out = montarOperadorAssinatura(session, "Maria Souza");
    expect((out as { nome: string }).nome).toBe("Maria Souza");
  });
});
