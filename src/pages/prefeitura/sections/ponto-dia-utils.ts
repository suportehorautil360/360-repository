import type { PontoRegistro } from "../../../lib/api/pontos";
import type { SolicitacaoPonto } from "../../../lib/api/solicitacoes-ponto";

/** YYYY-MM-DD local de um ISO. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Dia (YYYY-MM-DD) a que uma solicitação se refere. */
export function diaDaSolicitacao(
  s: SolicitacaoPonto,
  batidas: PontoRegistro[],
): string {
  if (s.tipo === "abono" && s.data) return s.data;
  if (s.tipo === "incluir" && s.timestampOriginal)
    return diaLocal(s.timestampOriginal);
  if (s.tipo === "cancelar" && s.batidaId) {
    const b = batidas.find((x) => x.id === s.batidaId);
    return b ? diaLocal(b.timestampOriginal) : "";
  }
  return diaLocal(s.createdAt);
}
