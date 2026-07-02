import {
  revisaoEm,
  revisaoRestante,
  TIPO_LABEL,
  unidadeDe,
  type VeiculoFrota,
} from "./frota/types";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Placa", largura: 90 },
  { titulo: "Veículo", largura: 220 },
  { titulo: "Tipo", largura: 120 },
  { titulo: "Progresso", largura: 90, alinhamento: "right" },
  { titulo: "Restante", largura: 110, alinhamento: "right" },
  { titulo: "Configuração", largura: 160 },
];

function progressoDe(v: VeiculoFrota): number {
  const limite = revisaoEm(v);
  if (limite <= 0) return 0;
  return Math.max(Math.min(Math.round((v.medicaoAtual / limite) * 100), 100), 0);
}

function linhaDoVeiculo(v: VeiculoFrota): string[] {
  const un = unidadeDe(v.tipo);
  return [
    v.placa,
    v.nome,
    TIPO_LABEL[v.tipo],
    `${progressoDe(v)}%`,
    `${Math.max(revisaoRestante(v), 0).toLocaleString("pt-BR")}${un}`,
    `a cada ${v.intervaloRevisao.toLocaleString("pt-BR")}${un}`,
  ];
}

export function nomeArquivoExportRevisoes(prefeituraId: string): string {
  return `revisoes-em-dia_${prefeituraId}.xls`;
}

export function baixarPlanilhaRevisoes(
  itens: VeiculoFrota[],
  opts: { prefeituraId: string },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportRevisoes(opts.prefeituraId),
    COLUNAS,
    itens.map(linhaDoVeiculo),
    "Em dia",
  );
}
