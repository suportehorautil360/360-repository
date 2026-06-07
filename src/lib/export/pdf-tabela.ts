/**
 * Geração de PDF de tabela (A4) com jsPDF — desenho manual, mesmo padrão do
 * ChecklistHistoricoLista. Reutilizável por relatórios tabulares.
 */
import { jsPDF } from "jspdf";

export interface PdfTabela {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: (string | number)[][];
  /** Linha de totais destacada no fim (opcional). */
  totais?: (string | number)[];
  /** Larguras relativas por coluna (mesma quantidade das colunas). Opcional. */
  pesos?: number[];
}

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const ROW_H = 7;

/** Monta o documento PDF (puro — não dispara download). */
export function gerarPDFTabela(opts: PdfTabela): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const usableW = right - left;

  const n = opts.colunas.length;
  const pesos = opts.pesos && opts.pesos.length === n ? opts.pesos : opts.colunas.map(() => 1);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((p) => (p / somaPesos) * usableW);
  const x = (col: number) => left + larguras.slice(0, col).reduce((a, b) => a + b, 0);

  let y = MARGIN;

  // Marca + título + subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Hora Útil 360", left, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, left, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (opts.subtitulo) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(opts.subtitulo, left, y);
    y += 6;
  }
  y += 2;

  function cabecalho() {
    doc.setFillColor(15, 35, 72);
    doc.rect(left, y, usableW, ROW_H, "F");
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    opts.colunas.forEach((c, i) => doc.text(String(c), x(i) + 2, y + 5));
    doc.setFont("helvetica", "normal");
    y += ROW_H;
  }

  function linha(valores: (string | number)[], bold = false) {
    if (y + ROW_H > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      cabecalho();
    }
    doc.setTextColor(30);
    doc.setFontSize(8);
    if (bold) doc.setFont("helvetica", "bold");
    valores.forEach((cel, i) => {
      const txt = cel === "" || cel == null ? "—" : String(cel);
      doc.text(txt, x(i) + 2, y + 5);
    });
    if (bold) doc.setFont("helvetica", "normal");
    doc.setDrawColor(220);
    doc.line(left, y + ROW_H, right, y + ROW_H);
    y += ROW_H;
  }

  cabecalho();
  for (const l of opts.linhas) linha(l);
  if (opts.totais) linha(opts.totais, true);

  // Rodapé (apenas o gerado pela marca; data fica a cargo do chamador)
  return doc;
}

/** Gera e dispara o download do PDF. */
export function baixarPDFTabela(nomeArquivo: string, opts: PdfTabela): void {
  gerarPDFTabela(opts).save(`${nomeArquivo}.pdf`);
}

// ---------------------------------------------------------------------------
// Recibo (documento chave:valor, não-tabela) — ex.: CRPT da Portaria 671.
// ---------------------------------------------------------------------------

export interface PdfReciboSecao {
  titulo?: string;
  itens: { rotulo: string; valor: string }[];
}

export interface PdfRecibo {
  titulo: string;
  subtitulo?: string;
  secoes: PdfReciboSecao[];
  /** Linhas de rodapé (ex.: nota legal). */
  rodape?: string[];
}

/**
 * Monta um PDF de recibo: cabeçalho (marca + título) e seções de pares
 * rótulo:valor. Valores longos (ex.: hash SHA-256) são quebrados em linhas.
 */
export function gerarPDFRecibo(opts: PdfRecibo): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const valorX = left + 42; // coluna dos valores
  const valorW = right - valorX;
  let y = MARGIN;

  const quebra = (y2: number) => {
    if (y2 > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Hora Útil 360", left, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, left, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (opts.subtitulo) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(opts.subtitulo, left, y);
    y += 6;
  }
  y += 2;

  for (const secao of opts.secoes) {
    if (secao.titulo) {
      quebra(y + 7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 35, 72);
      doc.text(secao.titulo.toUpperCase(), left, y + 4);
      doc.setDrawColor(220);
      doc.line(left, y + 6, right, y + 6);
      doc.setFont("helvetica", "normal");
      y += 9;
    }
    for (const item of secao.itens) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(item.rotulo, left, y + 4);
      doc.setTextColor(30);
      const linhas = doc.splitTextToSize(item.valor || "—", valorW) as string[];
      linhas.forEach((ln, i) => {
        if (i > 0) y += 5;
        quebra(y + 5);
        doc.text(ln, valorX, y + 4);
      });
      y += 7;
    }
    y += 1;
  }

  if (opts.rodape?.length) {
    y += 2;
    doc.setDrawColor(220);
    doc.line(left, y, right, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(130);
    for (const ln of opts.rodape) {
      const wrapped = doc.splitTextToSize(ln, right - left) as string[];
      for (const w of wrapped) {
        quebra(y + 4);
        doc.text(w, left, y + 3);
        y += 4;
      }
    }
  }

  return doc;
}

/** Gera e dispara o download do recibo em PDF. */
export function baixarPDFRecibo(nomeArquivo: string, opts: PdfRecibo): void {
  gerarPDFRecibo(opts).save(`${nomeArquivo}.pdf`);
}
