import type { OperadorSession } from "./useOperadorSession";

export type AssinaturaChassi = {
  tipo: "chassi";
  nomeInformado: string;
  chassiUsado: string;
  idMaquina: string;
};

export type AssinaturaFuncionario = {
  tipo: "funcionario";
  funcionarioId: string;
  nome: string;
  cpf: string;
};

export type OperadorAssinatura = AssinaturaChassi | AssinaturaFuncionario;

/**
 * Monta o objeto `operadorAssinatura` a ser gravado no checklist.
 * O `nomeDigitado` (campo livre digitado na tela) sobrescreve o nome da sessão.
 */
export function montarOperadorAssinatura(
  session: OperadorSession,
  nomeDigitado?: string,
): OperadorAssinatura {
  const nome = (
    nomeDigitado?.trim() ||
    session.nomeInformado ||
    session.nome
  ).trim();

  if (session.modoLogin === "chassi") {
    return {
      tipo: "chassi",
      nomeInformado: nome,
      chassiUsado: session.chassis ?? "",
      idMaquina: session.idMaquina ?? "",
    };
  }

  return {
    tipo: "funcionario",
    funcionarioId: session.funcionarioId ?? "",
    nome,
    cpf: session.cpf ?? "",
  };
}
