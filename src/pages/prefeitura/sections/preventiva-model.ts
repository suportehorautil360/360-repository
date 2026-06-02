/**
 * Modelo de apresentação da Preventiva — funções puras derivadas da frota
 * (coleção `equipamentos`). É a mesma manutenção das Revisões, em tabela plana.
 */
import {
  revisaoEm,
  revisaoRestante,
  statusRevisao,
  unidadeDe,
  type StatusRevisao,
  type VeiculoFrota,
} from "./frota/types";

export interface PreventivaRow {
  id: string;
  idChassiPlaca: string;
  nomeEquipamento: string;
  tipoMedidor: "KM" | "Horímetro";
  planoIntervalo: string;
  ultimaPreventiva: string;
  proximaPreventivaMeta: string;
  leituraAtual: string;
  restanteParaVencer: string;
  status: StatusRevisao;
}

function fmt(valor: number, unidade: string): string {
  return `${valor.toLocaleString("pt-BR")} ${unidade}`;
}

export function toPreventivaRow(v: VeiculoFrota): PreventivaRow {
  const unidade = unidadeDe(v.tipo); // "km" | "h"
  const restante = revisaoRestante(v);
  return {
    id: v.id,
    idChassiPlaca: v.placa || "—",
    nomeEquipamento: v.nome,
    tipoMedidor: unidade === "h" ? "Horímetro" : "KM",
    planoIntervalo: fmt(v.intervaloRevisao, unidade),
    ultimaPreventiva: fmt(v.ultimaRevisao, unidade),
    proximaPreventivaMeta: fmt(revisaoEm(v), unidade),
    leituraAtual: fmt(v.medicaoAtual, unidade),
    restanteParaVencer:
      restante > 0
        ? fmt(restante, unidade)
        : `vencido ${fmt(Math.abs(restante), unidade)}`,
    status: statusRevisao(v),
  };
}

/** Lista ordenada: vencidas primeiro, depois próximas, depois em dia. */
export function montarPreventivas(lista: VeiculoFrota[]): PreventivaRow[] {
  const peso: Record<StatusRevisao, number> = {
    vencida: 0,
    proxima: 1,
    "em-dia": 2,
  };
  return [...lista]
    .sort((a, b) => {
      const pa = peso[statusRevisao(a)];
      const pb = peso[statusRevisao(b)];
      if (pa !== pb) return pa - pb;
      return revisaoRestante(a) - revisaoRestante(b);
    })
    .map(toPreventivaRow);
}
