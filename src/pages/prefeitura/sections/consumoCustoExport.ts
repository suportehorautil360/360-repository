import type { VeiculoConsumoCusto } from "../../../lib/api/consumoCusto";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Veículo", largura: 200 },
  { titulo: "Placa", largura: 90 },
  { titulo: "Categoria", largura: 100 },
  { titulo: "Local", largura: 160 },
  { titulo: "Consumo médio", largura: 110, alinhamento: "right" },
  { titulo: "Custo unitário", largura: 110, alinhamento: "right" },
  { titulo: "Litros total", largura: 90, alinhamento: "right" },
  { titulo: "Gasto total", largura: 110, alinhamento: "right" },
];

function linha(item: VeiculoConsumoCusto): string[] {
  return [
    item.nome,
    item.placa || item.subtitulo,
    item.categoria,
    item.local,
    item.consumoLabel,
    item.custoLabel,
    item.litrosLabel,
    item.gastoLabel,
  ];
}

export function nomeArquivoExportConsumoCusto(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
): string {
  return `consumo_custo_${periodoInicio}_${periodoFim}_${prefeituraId}.xls`;
}

export function baixarPlanilhaConsumoCusto(
  itens: VeiculoConsumoCusto[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportConsumoCusto(
      opts.prefeituraId,
      opts.periodoInicio,
      opts.periodoFim,
    ),
    COLUNAS,
    itens.map(linha),
    "Consumo e Custo",
  );
}
