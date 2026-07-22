/**
 * Classificação Alto/Médio/Baixo a partir de um registro de checklist.
 * Conta "Não" reais (itensNao / totalNao) — nunca totalItens − totalSim
 * (que tratava N/A como Não).
 */

import type { ChecklistRegistroApi } from "./checklists-registros";
import {
  riskTriageNivelParaUi,
  type RiskTriageRowApi,
} from "./risk-triage";

export interface RiscoUiRow {
  id: string;
  nivel: "Alto" | "Médio" | "Baixo";
  categoria: string;
  tipoEquipamento: string;
  chassis: string;
  operador: string;
  defeito: string;
  acaoSugerida: string;
}

const ordemNivel: Record<RiscoUiRow["nivel"], number> = {
  Alto: 0,
  Médio: 1,
  Baixo: 2,
};

function parseTituloItemNao(titulo: string): {
  defeito: string;
  acaoSugerida: string;
} {
  const cleaned = titulo.replace(/^(Sim\/N[ãa]o|N[ãa]o|Sim):\s*/i, "");
  const idx = cleaned.indexOf(": ");
  if (idx === -1) return { defeito: cleaned.trim(), acaoSugerida: "—" };
  return {
    defeito: cleaned.slice(0, idx).trim(),
    acaoSugerida: cleaned.slice(idx + 2).trim(),
  };
}

function acaoPorTotalNao(totalNao: number): string {
  if (totalNao >= 2) {
    return "Acionar manutenção imediata e impedir operação até regularização.";
  }
  if (totalNao === 1) {
    return "Agendar correção e realizar nova inspeção antes da próxima operação.";
  }
  return "Sem ação imediata. Manter monitoramento preventivo.";
}

/** Quantidade real de respostas "Não". */
export function contarNaoDoRegistro(doc: ChecklistRegistroApi): number {
  if (Array.isArray(doc.itensNao) && doc.itensNao.length > 0) {
    return doc.itensNao.length;
  }
  if (typeof doc.totalNao === "number" && Number.isFinite(doc.totalNao)) {
    return Math.max(0, doc.totalNao);
  }
  return 0;
}

export function mapRegistroParaRisco(doc: ChecklistRegistroApi): RiscoUiRow {
  const totalNao = contarNaoDoRegistro(doc);
  const temImpeditivo = (doc.itensNao ?? []).some(
    (item) => item?.impeditivo === true,
  );
  // Impeditivo reprovado → Alto (mesmo com 1 "Não"). Continua indo para
  // emergência e também aparece na triagem de risco.
  const nivel: RiscoUiRow["nivel"] = temImpeditivo
    ? "Alto"
    : totalNao >= 2
      ? "Alto"
      : totalNao === 1
        ? "Médio"
        : "Baixo";

  const primeiroNao =
    doc.itensNao?.find((item) => item?.impeditivo === true) ??
    doc.itensNao?.[0];
  const problema =
    primeiroNao && typeof primeiroNao.problema === "string"
      ? primeiroNao.problema.trim()
      : "";
  const fromTitulo = primeiroNao?.titulo
    ? parseTituloItemNao(String(primeiroNao.titulo))
    : { defeito: "—", acaoSugerida: "—" };

  return {
    id: doc.id,
    nivel,
    categoria: doc.modelo || doc.categoria || "—",
    tipoEquipamento: doc.categoria || doc.linha || "—",
    chassis: doc.chassis || "—",
    operador: doc.operador || "—",
    defeito: problema || fromTitulo.defeito || "—",
    acaoSugerida: temImpeditivo
      ? "Acionar equipe de manutenção imediatamente (emergência gerada)."
      : fromTitulo.acaoSugerida !== "—"
        ? fromTitulo.acaoSugerida
        : acaoPorTotalNao(totalNao),
  };
}

export function mapRiskTriageParaUi(
  row: RiskTriageRowApi,
  index: number,
): RiscoUiRow {
  return {
    id: `triage-${index}-${row.nomeEquipamento}-${row.nomeOperador}`,
    nivel: riskTriageNivelParaUi(row.risco),
    categoria: row.nomeEquipamento || "—",
    tipoEquipamento: row.tipoEquipamento || "—",
    chassis: row.chassis || "—",
    operador: row.nomeOperador || "—",
    defeito: row.defeito || "—",
    acaoSugerida: row.acaoSugerida || "—",
  };
}

export function ordenarRiscosPorNivel(rows: RiscoUiRow[]): RiscoUiRow[] {
  return [...rows].sort(
    (a, b) => ordemNivel[a.nivel] - ordemNivel[b.nivel],
  );
}
