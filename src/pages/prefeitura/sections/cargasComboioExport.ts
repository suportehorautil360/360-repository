import type { CargaComboioTela } from "../../../lib/api/reabastecimentos";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Data", largura: 130 },
  { titulo: "Litros recebidos", largura: 130, alinhamento: "right" },
  { titulo: "Origem", largura: 120 },
  { titulo: "Nota fiscal", largura: 140 },
];

function formatarLitros(litros: number): string {
  return `+${litros.toLocaleString("pt-BR")} L`;
}

function linhaDoRegistro(item: CargaComboioTela): string[] {
  return [
    item.data,
    formatarLitros(item.litros),
    item.origem,
    item.notaFiscal,
  ];
}

export function nomeArquivoExportCargasComboio(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
): string {
  return `cargas-comboio_${periodoInicio}_${periodoFim}_${prefeituraId}.xls`;
}

export function baixarPlanilhaCargasComboio(
  itens: CargaComboioTela[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportCargasComboio(
      opts.prefeituraId,
      opts.periodoInicio,
      opts.periodoFim,
    ),
    COLUNAS,
    itens.map(linhaDoRegistro),
    "Cargas do Comboio",
  );
}
