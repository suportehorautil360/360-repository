import type { OperadorSession } from "./useOperadorSession";

/**
 * Um registro (checklist/emergência) pertence ao operador logado?
 * - Supervisor/admin: enxergam tudo da prefeitura (não filtra).
 * - Operador: casa por `funcionarioId`; em registros antigos (sem esse campo),
 *   cai no nome do operador como fallback de transição.
 */
export function registroDoOperador(
  data: Record<string, unknown>,
  session: OperadorSession,
): boolean {
  if (session.tipo === "supervisor" || session.tipo === "admin") return true;
  const fid = String(data.funcionarioId ?? "");
  if (session.funcionarioId && fid) return fid === session.funcionarioId;
  // Legado: registro sem funcionarioId → casa pelo nome do operador.
  const nomeReg = String(data.operador ?? data.Operador ?? "")
    .trim()
    .toLowerCase();
  return nomeReg === session.nome.trim().toLowerCase();
}
