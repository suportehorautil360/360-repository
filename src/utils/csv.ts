/** Utilitários para exportar planilhas CSV (Excel pt-BR: `;` + BOM UTF-8). */

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows: string[][], separator = ";"): string {
  return rows.map((row) => row.map(escapeCell).join(separator)).join("\n");
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
