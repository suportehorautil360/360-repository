/** Exporta planilha estilizada para Excel/LibreOffice (HTML com extensão .xls). */

function escapeHtml(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ColunaPlanilha = {
  titulo: string;
  /** Largura mínima em pixels. */
  largura?: number;
  alinhamento?: "left" | "center" | "right";
  /** Preserva quebras de linha na célula (útil para textos longos). */
  quebraLinha?: boolean;
};

export function downloadPlanilhaEstilizada(
  filename: string,
  colunas: ColunaPlanilha[],
  linhas: string[][],
  nomeAba = "Dados",
): void {
  const headerCells = colunas
    .map((col) => {
      const w = col.largura ? `min-width:${col.largura}px;` : "";
      return `<th style="${w}">${escapeHtml(col.titulo)}</th>`;
    })
    .join("");

  const bodyRows = linhas
    .map((linha, idx) => {
      const zebra = idx % 2 === 1 ? " class=\"zebra\"" : "";
      const cells = linha
        .map((valor, colIdx) => {
          const col = colunas[colIdx];
          const alinhamento = col?.alinhamento ?? "left";
          const wrap = col?.quebraLinha
            ? "white-space:pre-wrap;vertical-align:top;line-height:1.35;"
            : "";
          return `<td style="text-align:${alinhamento};${wrap}">${escapeHtml(valor)}</td>`;
        })
        .join("");
      return `<tr${zebra}>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>${escapeHtml(nomeAba)}</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    table { border-collapse: collapse; font-family: "Segoe UI", Calibri, Arial, sans-serif; }
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
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const nome =
    filename.endsWith(".xls") || filename.endsWith(".xlsx")
      ? filename
      : `${filename}.xls`;

  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
