import type { PostoTela } from "../../../lib/api/postos";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Posto", largura: 200 },
  { titulo: "Código", largura: 70 },
  { titulo: "Endereço", largura: 240 },
  { titulo: "Preço/L", largura: 90, alinhamento: "right" },
  { titulo: "Abastec.", largura: 80, alinhamento: "right" },
  { titulo: "Litros", largura: 80, alinhamento: "right" },
  { titulo: "Gasto", largura: 110, alinhamento: "right" },
];

function linhaDoPosto(item: PostoTela): string[] {
  return [
    item.nome,
    item.codigo,
    item.endereco,
    item.precoLitroLabel,
    String(item.abastecimentos),
    item.litrosLabel,
    item.gastoLabel,
  ];
}

export function nomeArquivoExportPostos(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
): string {
  return `postos_${periodoInicio}_${periodoFim}_${prefeituraId}.xls`;
}

export function baixarPlanilhaPostos(
  itens: PostoTela[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportPostos(
      opts.prefeituraId,
      opts.periodoInicio,
      opts.periodoFim,
    ),
    COLUNAS,
    itens.map(linhaDoPosto),
    "Postos",
  );
}
