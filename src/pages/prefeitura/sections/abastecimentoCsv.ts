import type { AbastecimentoTela } from "../../../lib/api/abastecimentos";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Data", largura: 130 },
  { titulo: "Veículo", largura: 220 },
  { titulo: "Placa", largura: 110 },
  { titulo: "Tipo", largura: 100 },
  { titulo: "Origem", largura: 120, alinhamento: "center" },
  { titulo: "Litros", largura: 80, alinhamento: "right" },
  { titulo: "Valor (R$)", largura: 110, alinhamento: "right" },
  { titulo: "Leitura", largura: 110 },
  { titulo: "Local", largura: 200 },
];

function formatarValor(valor: number | null): string {
  if (valor === null) return "";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function linhaDoItem(item: AbastecimentoTela): string[] {
  return [
    item.data,
    item.veiculo,
    item.placa,
    item.tipoVeiculo,
    item.origemNome,
    String(item.litros),
    formatarValor(item.valor),
    item.leitura,
    item.local,
  ];
}

export function nomeArquivoExportAbastecimentos(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
  filtroOrigem: "todas" | "comboio" | "posto",
): string {
  const origem = filtroOrigem === "todas" ? "todas-origens" : filtroOrigem;
  return `abastecimentos_${periodoInicio}_${periodoFim}_${origem}_${prefeituraId}.xls`;
}

export function baixarCsvAbastecimentos(
  itens: AbastecimentoTela[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
    filtroOrigem: "todas" | "comboio" | "posto";
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportAbastecimentos(
      opts.prefeituraId,
      opts.periodoInicio,
      opts.periodoFim,
      opts.filtroOrigem,
    ),
    COLUNAS,
    itens.map(linhaDoItem),
    "Abastecimentos",
  );
}
