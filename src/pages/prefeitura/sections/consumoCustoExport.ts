import type { VeiculoConsumoCusto } from "../../../lib/api/consumoCusto";
import {
  downloadPlanilhaEstilizada,
  type ColunaPlanilha,
} from "../../../utils/spreadsheet";

const COLUNAS_RESUMO: ColunaPlanilha[] = [
  { titulo: "Veículo", largura: 200 },
  { titulo: "Placa", largura: 90 },
  { titulo: "Categoria", largura: 100 },
  { titulo: "Local", largura: 160 },
  { titulo: "Consumo médio", largura: 110, alinhamento: "right" },
  { titulo: "Custo unitário", largura: 110, alinhamento: "right" },
  { titulo: "Litros total", largura: 90, alinhamento: "right" },
  { titulo: "Gasto total", largura: 110, alinhamento: "right" },
];

const COLUNAS_INTERVALOS: ColunaPlanilha[] = [
  { titulo: "Veículo", largura: 180 },
  { titulo: "Placa", largura: 90 },
  { titulo: "Período", largura: 260 },
  { titulo: "Distância / duração", largura: 120 },
  { titulo: "Consumo", largura: 100, alinhamento: "right" },
  { titulo: "Custo", largura: 100, alinhamento: "right" },
];

function linhaResumo(item: VeiculoConsumoCusto): string[] {
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

function linhasIntervalos(itens: VeiculoConsumoCusto[]): string[][] {
  const linhas: string[][] = [];
  for (const item of itens) {
    for (const intervalo of item.intervalos) {
      linhas.push([
        item.nome,
        item.placa || "—",
        intervalo.periodoLabel,
        intervalo.duracaoLabel,
        intervalo.consumoLabel,
        intervalo.custoLabel,
      ]);
    }
  }
  return linhas;
}

export function nomeArquivoExportConsumoCusto(
  prefeituraId: string,
  periodoInicio: string,
  periodoFim: string,
): string {
  return `consumo_custo_${periodoInicio}_${periodoFim}_${prefeituraId}.xls`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tabelaHtml(
  colunas: ColunaPlanilha[],
  linhas: string[][],
  tituloSecao: string,
): string {
  const headerCells = colunas
    .map((col) => {
      const w = col.largura ? `min-width:${col.largura}px;` : "";
      return `<th style="${w}">${escapeHtml(col.titulo)}</th>`;
    })
    .join("");

  const bodyRows = linhas
    .map((linha, idx) => {
      const zebra = idx % 2 === 1 ? ' class="zebra"' : "";
      const cells = linha
        .map((valor, colIdx) => {
          const col = colunas[colIdx];
          const alinhamento = col?.alinhamento ?? "left";
          return `<td style="text-align:${alinhamento};">${escapeHtml(valor)}</td>`;
        })
        .join("");
      return `<tr${zebra}>${cells}</tr>`;
    })
    .join("");

  return `
    <h2 style="font-family:Segoe UI, Calibri, Arial, sans-serif;color:#0f172a;margin:24px 0 8px;">${escapeHtml(tituloSecao)}</h2>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

export function baixarPlanilhaConsumoCusto(
  itens: VeiculoConsumoCusto[],
  opts: {
    prefeituraId: string;
    periodoInicio: string;
    periodoFim: string;
    periodoLabel?: string;
  },
): void {
  const resumoLinhas = itens.map(linhaResumo);
  const intervaloLinhas = linhasIntervalos(itens);
  const periodo =
    opts.periodoLabel?.trim() ||
    `${opts.periodoInicio} — ${opts.periodoFim}`;

  if (intervaloLinhas.length === 0) {
    downloadPlanilhaEstilizada(
      nomeArquivoExportConsumoCusto(
        opts.prefeituraId,
        opts.periodoInicio,
        opts.periodoFim,
      ),
      COLUNAS_RESUMO,
      resumoLinhas,
      "Consumo e Custo",
    );
    return;
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>Consumo e Custo</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    table { border-collapse: collapse; font-family: "Segoe UI", Calibri, Arial, sans-serif; margin-bottom: 8px; }
    th {
      background: #0f172a;
      color: #f97316;
      font-weight: 700;
      font-size: 11pt;
      padding: 10px 14px;
      border: 1px solid #334155;
      text-align: center;
      white-space: nowrap;
    }
    td {
      font-size: 10pt;
      padding: 9px 14px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: middle;
    }
    tr.zebra td { background: #f8fafc; }
  </style>
</head>
<body>
  ${tabelaHtml(COLUNAS_RESUMO, resumoLinhas, `Resumo por veículo — ${periodo}`)}
  ${tabelaHtml(COLUNAS_INTERVALOS, intervaloLinhas, `Detalhamento por intervalo — ${periodo}`)}
</body>
</html>`;

  const nome = nomeArquivoExportConsumoCusto(
    opts.prefeituraId,
    opts.periodoInicio,
    opts.periodoFim,
  );
  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome.endsWith(".xls") ? nome : `${nome}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
