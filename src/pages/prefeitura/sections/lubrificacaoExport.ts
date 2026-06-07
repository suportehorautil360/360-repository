import type { LubrificacaoTela } from "../../../lib/api/lubrificacoes";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Data", largura: 130 },
  { titulo: "Equipamento", largura: 220 },
  { titulo: "Identificação", largura: 110 },
  { titulo: "Leitura", largura: 90, alinhamento: "right" },
  { titulo: "Pontos engraxados", largura: 280 },
  { titulo: "Comboísta", largura: 120 },
];

function linhaDoRegistro(item: LubrificacaoTela): string[] {
  return [
    item.data,
    item.equipamento,
    item.identificacao,
    item.leitura,
    item.pontos.join(", "),
    item.comboista,
  ];
}

export function nomeArquivoExportLubrificacao(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
): string {
  return `lubrificacao_${periodoInicio}_${periodoFim}_${prefeituraId}.xls`;
}

export function baixarPlanilhaLubrificacao(
  itens: LubrificacaoTela[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
  },
): void {
  downloadPlanilhaEstilizada(
    nomeArquivoExportLubrificacao(
      opts.prefeituraId,
      opts.periodoInicio,
      opts.periodoFim,
    ),
    COLUNAS,
    itens.map(linhaDoRegistro),
    "Lubrificação",
  );
}
