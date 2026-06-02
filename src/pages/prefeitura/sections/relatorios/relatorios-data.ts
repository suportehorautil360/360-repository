/**
 * Monta os datasets dos relatórios da prefeitura a partir das fontes já
 * existentes (equipamentos/frota, frentes, abastecimentos). Os builders são
 * funções puras (testáveis); `carregarRelatorios` faz as chamadas e agrega.
 */
import { frotaApi } from "../frota/frota-api";
import { frentesApi, formatDataBR, type Frente } from "../frentes/frentes-api";
import { abastecimentosApi } from "./abastecimentos-api";
import { montarPreventivas } from "../preventiva-model";
import {
  TIPO_LABEL,
  isBloqueado,
  unidadeDe,
  type VeiculoFrota,
} from "../frota/types";
import { formatBRL, parseValorBR } from "../../../../utils/moeda";
import type { AbastecimentoRegistro } from "../../../../lib/hu360/types";
import type { Dataset } from "../../../../lib/export/export-utils";

export type RelatorioKey =
  | "frota"
  | "abastecimentos"
  | "frentes"
  | "custos"
  | "preventiva"
  | "alocacao";

export interface RelatorioMeta {
  key: RelatorioKey;
  titulo: string;
  descricao: string;
  icone: string;
  /** Relatório só de pré-visualização (sem card de export próprio). */
  somentePreview?: boolean;
}

export const RELATORIOS: RelatorioMeta[] = [
  {
    key: "frota",
    titulo: "Relatório de frota",
    descricao: "Veículos com tipo, placa, medição e obra.",
    icone: "🚛",
  },
  {
    key: "abastecimentos",
    titulo: "Abastecimentos",
    descricao: "Histórico de combustível por veículo e motorista.",
    icone: "⛽",
  },
  {
    key: "frentes",
    titulo: "Relatório de Frentes de Trabalho",
    descricao: "Frentes de Trabalho com status, responsável e equipamentos.",
    icone: "🏗️",
  },
  {
    key: "custos",
    titulo: "Custos por Frente de Trabalho",
    descricao: "Lançamentos agrupados por Frente de Trabalho e equipamento.",
    icone: "💰",
  },
  {
    key: "preventiva",
    titulo: "Manutenção preventiva",
    descricao: "Plano completo com status e próxima manutenção.",
    icone: "🔧",
  },
  {
    key: "alocacao",
    titulo: "Alocação",
    descricao: "Equipamentos alocados por frente e função.",
    icone: "📋",
    somentePreview: true,
  },
];

export interface RelatoriosKpis {
  lancamentos: number;
  gastoGeral: string;
  veiculos: number;
  frentes: number;
}

export interface RelatoriosBundle {
  kpis: RelatoriosKpis;
  datasets: Record<RelatorioKey, Dataset>;
}

// --- Lookups ---

interface AlocInfo {
  frente: string;
  funcao: string;
  desde: string;
}

/** vehicleId → frente/função/desde (a partir das alocações das frentes). */
export function mapaAlocacao(frentes: Frente[]): Map<string, AlocInfo> {
  const m = new Map<string, AlocInfo>();
  for (const f of frentes) {
    for (const al of f.equipamentos) {
      m.set(al.vehicleId, {
        frente: f.nome,
        funcao: al.funcao || "—",
        desde: al.desde || "—",
      });
    }
  }
  return m;
}

// --- Builders (puros) ---

export function datasetFrota(
  frota: VeiculoFrota[],
  aloc: Map<string, AlocInfo>,
): Dataset {
  return {
    colunas: [
      "Nome",
      "Placa",
      "Tipo",
      "Marca",
      "Ano",
      "Medição",
      "Unidade",
      "Frente de Trabalho",
      "Função",
      "Rev. Intervalo",
      "Rev. Unidade",
      "Status Rev.",
    ],
    linhas: frota.map((v) => {
      const a = aloc.get(v.id);
      return [
        v.nome,
        v.placa,
        TIPO_LABEL[v.tipo],
        v.marca,
        v.ano || "",
        v.medicaoAtual,
        unidadeDe(v.tipo),
        a?.frente || (v.obra?.trim() ? v.obra : "Disponível"),
        a?.funcao || "—",
        v.intervaloRevisao,
        unidadeDe(v.tipo),
        isBloqueado(v) ? "Bloqueado" : "Em dia",
      ];
    }),
  };
}

export function datasetAbastecimentos(abs: AbastecimentoRegistro[]): Dataset {
  return {
    colunas: [
      "Data",
      "Hora",
      "Veículo",
      "Placa",
      "Motorista",
      "Combustível",
      "Litros",
      "Valor",
      "KM",
      "Posto",
      "Cupom",
    ],
    linhas: abs.map((a) => [
      a.data,
      a.hora,
      a.veiculo,
      a.placa,
      a.motorista,
      a.combustivel,
      a.litros,
      a.valorTotal,
      a.km,
      a.postoNome,
      a.cupomFiscal,
    ]),
  };
}

export function datasetFrentes(frentes: Frente[]): Dataset {
  return {
    colunas: [
      "Nome",
      "Status",
      "Responsável",
      "Endereço",
      "Início",
      "Fim",
      "Custo",
      "Equipamentos",
    ],
    linhas: frentes.map((f) => [
      f.nome,
      f.status,
      f.responsavel,
      f.endereco,
      formatDataBR(f.inicio),
      formatDataBR(f.fim),
      formatBRL(f.custo),
      f.equipamentos.length,
    ]),
  };
}

/** Agrupa abastecimentos por frente (via placa→obra) e equipamento (placa). */
export function datasetCustos(
  abs: AbastecimentoRegistro[],
  frota: VeiculoFrota[],
  aloc: Map<string, AlocInfo>,
): Dataset {
  const frentePorPlaca = new Map<string, string>();
  for (const v of frota) {
    const frente = aloc.get(v.id)?.frente || (v.obra?.trim() ? v.obra : "");
    if (v.placa) frentePorPlaca.set(v.placa, frente || "Sem frente");
  }

  const grupos = new Map<string, { frente: string; placa: string; n: number; total: number }>();
  for (const a of abs) {
    const frente = frentePorPlaca.get(a.placa) || "Sem frente";
    const chave = `${frente}||${a.placa}`;
    const g = grupos.get(chave) ?? { frente, placa: a.placa || "—", n: 0, total: 0 };
    g.n += 1;
    g.total += parseValorBR(a.valorTotal);
    grupos.set(chave, g);
  }

  const linhas = [...grupos.values()]
    .sort((x, y) => y.total - x.total)
    .map((g) => [g.frente, g.placa, g.n, formatBRL(g.total)]);

  return {
    colunas: ["Frente de Trabalho", "Equipamento (placa)", "Lançamentos", "Total"],
    linhas,
  };
}

const PREVENTIVA_STATUS: Record<string, string> = {
  vencida: "Vencida",
  proxima: "Próxima",
  "em-dia": "Em dia",
};

export function datasetPreventiva(frota: VeiculoFrota[]): Dataset {
  return {
    colunas: [
      "ID (Chassi/Placa)",
      "Equipamento",
      "Medidor",
      "Plano/Intervalo",
      "Última",
      "Próxima (Meta)",
      "Leitura Atual",
      "Restante",
      "Status",
    ],
    linhas: montarPreventivas(frota).map((r) => [
      r.idChassiPlaca,
      r.nomeEquipamento,
      r.tipoMedidor,
      r.planoIntervalo,
      r.ultimaPreventiva,
      r.proximaPreventivaMeta,
      r.leituraAtual,
      r.restanteParaVencer,
      PREVENTIVA_STATUS[r.status] ?? r.status,
    ]),
  };
}

export function datasetAlocacao(
  frentes: Frente[],
  frota: VeiculoFrota[],
): Dataset {
  const nomePorId = new Map(frota.map((v) => [v.id, v.nome]));
  const linhas: (string | number)[][] = [];
  for (const f of frentes) {
    for (const al of f.equipamentos) {
      linhas.push([
        nomePorId.get(al.vehicleId) || al.nome,
        al.placa || "—",
        f.nome,
        al.desde || "—",
        al.funcao || "—",
        "Ativa",
      ]);
    }
  }
  return {
    colunas: ["Equipamento", "Placa", "Frente de Trabalho", "Desde", "Função", "Status"],
    linhas,
  };
}

/** Carrega as fontes e monta todos os datasets + KPIs. */
export async function carregarRelatorios(
  prefeituraId: string,
): Promise<RelatoriosBundle> {
  const [frota, frentes, abs] = await Promise.all([
    frotaApi.listar(prefeituraId),
    frentesApi.listar(prefeituraId),
    abastecimentosApi.listar(prefeituraId),
  ]);

  const aloc = mapaAlocacao(frentes);
  const gasto = abs.reduce((acc, a) => acc + parseValorBR(a.valorTotal), 0);

  return {
    kpis: {
      lancamentos: abs.length,
      gastoGeral: formatBRL(gasto),
      veiculos: frota.length,
      frentes: frentes.length,
    },
    datasets: {
      frota: datasetFrota(frota, aloc),
      abastecimentos: datasetAbastecimentos(abs),
      frentes: datasetFrentes(frentes),
      custos: datasetCustos(abs, frota, aloc),
      preventiva: datasetPreventiva(frota),
      alocacao: datasetAlocacao(frentes, frota),
    },
  };
}
