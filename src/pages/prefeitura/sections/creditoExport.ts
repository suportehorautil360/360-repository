import type { LancamentoCreditoTela } from "../../../lib/api/credito";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Data", largura: 100 },
  { titulo: "Tipo", largura: 100 },
  { titulo: "Destino", largura: 220 },
  { titulo: "Valor", largura: 110, alinhamento: "right" },
  { titulo: "Responsável", largura: 120 },
  { titulo: "Obs.", largura: 160 },
];

function linha(item: LancamentoCreditoTela): string[] {
  return [
    item.dataLabel,
    item.tipoLabel,
    item.destino,
    item.valorLabel,
    item.responsavel,
    item.observacao,
  ];
}

export function nomeArquivoExportCredito(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
): string {
  return `credito_${periodoInicio}_${periodoFim}_${prefeituraId}.xls`;
}

export function baixarPlanilhaCredito(
  itens: LancamentoCreditoTela[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportCredito(
      opts.prefeituraId,
      opts.periodoInicio,
      opts.periodoFim,
    ),
    COLUNAS,
    itens.map(linha),
    "Crédito",
  );
}
