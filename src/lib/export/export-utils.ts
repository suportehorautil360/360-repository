/**
 * Utilitários de exportação — CSV, Excel (xlsx, import dinâmico) e JSON.
 * Um dataset é um conjunto de colunas (cabeçalhos) + linhas alinhadas.
 */

export type Celula = string | number;

export interface Dataset {
  /** Cabeçalhos, na ordem das colunas. */
  colunas: string[];
  /** Linhas; cada linha alinhada às colunas. */
  linhas: Celula[][];
}

export interface AbaExcel extends Dataset {
  /** Nome da aba (sheet). */
  nome: string;
}

const SEP = ";"; // Excel pt-BR usa ponto-e-vírgula

/** Escapa uma célula para CSV (aspas se contiver separador/aspas/quebra). */
function escaparCsv(valor: Celula): string {
  const s = String(valor ?? "");
  if (s.includes(SEP) || s.includes('"') || /[\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Gera o conteúdo CSV (string) de um dataset. Função pura. */
export function toCSV({ colunas, linhas }: Dataset): string {
  const linhasCsv = [colunas, ...linhas].map((linha) =>
    linha.map(escaparCsv).join(SEP),
  );
  return linhasCsv.join("\r\n");
}

/** Dispara o download de um Blob com o nome informado. */
function baixarBlob(nomeArquivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Baixa um dataset como .csv (com BOM, pra acentos no Excel). */
export function baixarCSV(nomeArquivo: string, dataset: Dataset): void {
  const conteudo = "﻿" + toCSV(dataset);
  baixarBlob(`${nomeArquivo}.csv`, new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
}

/** Baixa uma ou mais abas como um único .xlsx. */
export async function baixarExcel(
  nomeArquivo: string,
  abas: AbaExcel[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const aba of abas) {
    const ws = XLSX.utils.aoa_to_sheet([aba.colunas, ...aba.linhas]);
    // Nome da aba: máx 31 chars, sem caracteres proibidos.
    const nome = aba.nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Dados";
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  baixarBlob(
    `${nomeArquivo}.xlsx`,
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

/** Baixa qualquer objeto serializável como .json (backup). */
export function baixarJSON(nomeArquivo: string, dados: unknown): void {
  const conteudo = JSON.stringify(dados, null, 2);
  baixarBlob(
    `${nomeArquivo}.json`,
    new Blob([conteudo], { type: "application/json;charset=utf-8" }),
  );
}
