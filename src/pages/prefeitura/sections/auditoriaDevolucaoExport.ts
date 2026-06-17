import type { LinhaAuditoriaDevolucao } from "./auditoria-devolucao-model";
import { linhaAuditoriaParaTela } from "./auditoria-devolucao-model";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Data", largura: 100 },
  { titulo: "Tipo", largura: 140 },
  { titulo: "Destino", largura: 220 },
  { titulo: "Valor", largura: 110, alinhamento: "right" },
  { titulo: "Responsável", largura: 120 },
  { titulo: "Obs.", largura: 360, quebraLinha: true },
];

function linha(item: LinhaAuditoriaDevolucao): string[] {
  const tela = linhaAuditoriaParaTela(item);
  return [
    tela.dataLabel,
    tela.tipoLabel,
    tela.destino,
    tela.valorLabel,
    tela.responsavel,
    tela.observacao,
  ];
}

export function nomeArquivoExportAuditoriaDevolucao(
  prefeituraId: string,
  dataInicio: string,
  dataFim: string,
): string {
  const ini = dataInicio || "inicio";
  const fim = dataFim || "fim";
  return `auditoria-devolucao_${ini}_${fim}_${prefeituraId}.xls`;
}

export function baixarPlanilhaAuditoriaDevolucao(
  linhas: LinhaAuditoriaDevolucao[],
  opts: {
    prefeituraId: string;
    dataInicio: string;
    dataFim: string;
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportAuditoriaDevolucao(
      opts.prefeituraId,
      opts.dataInicio,
      opts.dataFim,
    ),
    COLUNAS,
    linhas.map(linha),
    "Auditoria de Devolução",
  );
}
