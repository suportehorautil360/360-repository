/**
 * Controle de "bateu o ponto hoje?" por dia + funcionário.
 * Guardado em localStorage (local ao dispositivo) — usado para o gate
 * obrigatório do checklist, uma vez por dia.
 *
 * Ponto é por pessoa, então a chave usa a identidade do funcionário
 * (funcionarioId/cpf). Para sessões legadas sem essa identidade, cai no
 * idMaquina antigo para não invalidar pontos já batidos.
 */
import type { OperadorSession } from "./useOperadorSession";

type SessaoPonto = Pick<
  OperadorSession,
  "funcionarioId" | "cpf" | "idMaquina"
>;

function hojeStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function identidade(s: SessaoPonto): string {
  return s.funcionarioId || s.cpf || s.idMaquina || "anon";
}

function chave(s: SessaoPonto): string {
  return `hu360-ponto:${hojeStr()}:${identidade(s)}`;
}

export function jaBateuHoje(s: SessaoPonto): boolean {
  try {
    return localStorage.getItem(chave(s)) === "1";
  } catch {
    return false;
  }
}

export function marcarBatidaHoje(s: SessaoPonto): void {
  try {
    localStorage.setItem(chave(s), "1");
  } catch {
    /* ignore */
  }
}
