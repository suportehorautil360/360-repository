/**
 * Controle de "bateu o ponto hoje?" por dia + máquina da sessão.
 * Guardado em localStorage (local ao dispositivo) — usado para o gate
 * obrigatório do checklist, uma vez por dia.
 */
import type { OperadorSession } from "./useOperadorSession";

function hojeStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function chave(s: Pick<OperadorSession, "idMaquina">): string {
  return `hu360-ponto:${hojeStr()}:${s.idMaquina}`;
}

export function jaBateuHoje(s: Pick<OperadorSession, "idMaquina">): boolean {
  try {
    return localStorage.getItem(chave(s)) === "1";
  } catch {
    return false;
  }
}

export function marcarBatidaHoje(s: Pick<OperadorSession, "idMaquina">): void {
  try {
    localStorage.setItem(chave(s), "1");
  } catch {
    /* ignore */
  }
}
