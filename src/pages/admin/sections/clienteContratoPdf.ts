import { jsPDF } from "jspdf";
import type { ClienteApi, ContratoClienteApi } from "../../../lib/api/clientes";

const MODALIDADE_LABEL: Record<string, string> = {
  pregao_eletronico: "Pregão eletrônico",
  pregao_presencial: "Pregão presencial",
  dispensa: "Dispensa de licitação",
  inexigibilidade: "Inexigibilidade",
  credenciamento: "Credenciamento / chamamento público",
  inexigibilidade_chamamento: "Inexigibilidade com chamamento",
  contrato_privado_locacao: "Contrato privado (locação)",
  outros: "Outros",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

const PERIODICIDADE_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const C_BRAND: [number, number, number] = [234, 88, 12];
const C_BRAND_DARK: [number, number, number] = [194, 65, 12];
const C_TITLE: [number, number, number] = [15, 23, 42];
const C_TEXT: [number, number, number] = [51, 65, 85];
const C_MUTED: [number, number, number] = [100, 116, 139];
const C_CARD: [number, number, number] = [248, 250, 252];
const C_BORDER: [number, number, number] = [226, 232, 240];
const C_OK: [number, number, number] = [22, 101, 52];
const C_WARN: [number, number, number] = [180, 83, 9];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;

function val(v: string | undefined | null): string {
  const t = v?.trim();
  return t || "—";
}

function fmtDataIso(iso: string | undefined): string {
  const t = iso?.trim();
  if (!t) return "—";
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
}

function labelMap(map: Record<string, string>, key: string | undefined): string {
  if (!key?.trim()) return "—";
  return map[key] ?? key.replace(/_/g, " ");
}

function tipoClienteLabel(tipo: ClienteApi["tipoCliente"]): string {
  return tipo === "locacao"
    ? "Empresa de locação"
    : "Prefeitura / órgão público";
}

function slugArquivo(nome: string, uf: string): string {
  const base = `${nome}-${uf}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return base || "cliente";
}

function statusCor(status: string | undefined): [number, number, number] {
  const s = status?.toLowerCase();
  if (s === "ativo") return C_OK;
  if (s === "suspenso") return C_WARN;
  return C_MUTED;
}

interface CampoPdf {
  rotulo: string;
  valor: string;
  /** Ocupa a linha inteira (ex.: objeto, observações). */
  largura?: "metade" | "inteira";
}

interface SecaoPdf {
  titulo: string;
  icone?: string;
  campos: CampoPdf[];
}

/** Desenha o PDF estilizado do contrato (exportado para testes). */
export function gerarPDFContratoCliente(cliente: ClienteApi): jsPDF {
  const contrato = cliente.contrato;
  if (!contrato?.numero?.trim() && !contrato?.objeto?.trim()) {
    throw new Error("Este cliente não possui dados de contrato para exportar.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const contentW = PAGE_W - MARGIN * 2;
  let y = 0;
  let pageNum = 1;

  const rodape = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(
      `Hora Útil 360 · Página ${pageNum}`,
      MARGIN,
      PAGE_H - 8,
    );
    doc.text(
      new Date().toLocaleString("pt-BR"),
      PAGE_W - MARGIN,
      PAGE_H - 8,
      { align: "right" },
    );
  };

  const novaPagina = () => {
    rodape();
    doc.addPage();
    pageNum += 1;
    desenharFaixaContinuacao();
  };

  const ensure = (altura: number) => {
    if (y + altura > PAGE_H - 18) novaPagina();
  };

  const desenharFaixaContinuacao = () => {
    doc.setFillColor(...C_BRAND_DARK);
    doc.rect(0, 0, PAGE_W, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("HORA ÚTIL 360 — Contrato (continuação)", MARGIN, 6.5);
    y = 16;
  };

  // —— Cabeçalho principal ——
  doc.setFillColor(...C_BRAND);
  doc.rect(0, 0, PAGE_W, 32, "F");
  doc.setFillColor(...C_BRAND_DARK);
  doc.rect(0, 28, PAGE_W, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("HORA ÚTIL 360", MARGIN, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Contrato de prestação de serviços", MARGIN, 20);
  doc.setFontSize(8.5);
  doc.text("Resumo cadastral — Hub Mestre", MARGIN, 26);

  y = 40;

  // —— Faixa do cliente ——
  const nome = val(cliente.nome);
  const uf = val(cliente.uf);
  const statusTxt = labelMap(STATUS_LABEL, contrato.status);
  const statusRgb = statusCor(contrato.status);

  doc.setFillColor(...C_CARD);
  doc.setDrawColor(...C_BORDER);
  doc.roundedRect(MARGIN, y, contentW, 22, 2, 2, "FD");

  doc.setTextColor(...C_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("CONTRATANTE", MARGIN + 4, y + 7);
  doc.setTextColor(...C_TITLE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${nome} (${uf})`, MARGIN + 4, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C_TEXT);
  doc.text(tipoClienteLabel(cliente.tipoCliente), MARGIN + 4, y + 19);

  // Badge status
  const badgeW = Math.min(doc.getTextWidth(statusTxt) + 10, 40);
  const badgeX = PAGE_W - MARGIN - badgeW - 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...statusRgb);
  doc.setLineWidth(0.35);
  doc.roundedRect(badgeX, y + 6, badgeW, 8, 2, 2, "FD");
  doc.setLineWidth(0.2);
  doc.setTextColor(...statusRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(statusTxt, badgeX + badgeW / 2, y + 11.5, { align: "center" });

  y += 28;

  // —— Destaque: número + objeto ——
  ensure(28);
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(...C_BRAND);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, contentW, 24, 2, 2, "FD");
  doc.setLineWidth(0.2);

  doc.setTextColor(...C_BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Nº DO INSTRUMENTO", MARGIN + 5, y + 8);
  doc.setFontSize(12);
  doc.text(val(contrato.numero), MARGIN + 5, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text("OBJETO", MARGIN + 5, y + 20);
  doc.setTextColor(...C_TEXT);
  doc.setFontSize(9);
  const objetoLinhas = doc.splitTextToSize(
    val(contrato.objeto),
    contentW - 10,
  ) as string[];
  doc.text(objetoLinhas[0] ?? "—", MARGIN + 22, y + 20);

  y += 30;

  const secoes: SecaoPdf[] = [
    {
      titulo: "Dados do contratante",
      campos: [
        { rotulo: "CNPJ", valor: val(cliente.cnpj) },
        { rotulo: "CAEPF / CEI", valor: val(cliente.caepf) },
        { rotulo: "Cidade", valor: val(cliente.cidade) },
        { rotulo: "WhatsApp", valor: val(cliente.whatsapp) },
      ],
    },
    {
      titulo: "Instrumento e vigência",
      campos: [
        { rotulo: "Processo / edital", valor: val(contrato.processo) },
        {
          rotulo: "Modalidade",
          valor: labelMap(MODALIDADE_LABEL, contrato.modalidade),
          largura: "inteira",
        },
        {
          rotulo: "Data de assinatura",
          valor: fmtDataIso(contrato.dataAssinatura),
        },
        { rotulo: "Início da vigência", valor: fmtDataIso(contrato.vigenciaInicio) },
        { rotulo: "Fim da vigência", valor: fmtDataIso(contrato.vigenciaFim) },
      ],
    },
    {
      titulo: "Valores e faturamento",
      campos: [
        { rotulo: "Valor mensal", valor: val(contrato.valorMensal) },
        { rotulo: "Valor total", valor: val(contrato.valorTotal) },
        { rotulo: "Índice de reajuste", valor: val(contrato.indiceReajuste) },
        {
          rotulo: "Periodicidade",
          valor: labelMap(
            PERIODICIDADE_LABEL,
            contrato.periodicidadeFaturamento,
          ),
        },
        {
          rotulo: "SLA de resposta",
          valor: contrato.slaRespostaHoras?.trim()
            ? `${contrato.slaRespostaHoras.trim()} horas`
            : "—",
        },
      ],
    },
    {
      titulo: "Fiscal e contato",
      campos: [
        { rotulo: "Responsável", valor: val(contrato.responsavelContratante) },
        { rotulo: "Cargo", valor: val(contrato.cargoContratante) },
        { rotulo: "E-mail", valor: val(contrato.emailContratante) },
        { rotulo: "Telefone", valor: val(contrato.telefoneContratante) },
        {
          rotulo: "Observações",
          valor: val(contrato.observacoes),
          largura: "inteira",
        },
      ],
    },
  ];

  const colW = (contentW - 6) / 2;
  const gapCol = 6;
  const pad = 4;

  const alturaCampo = (valor: string, w: number): number => {
    const linhas = doc.splitTextToSize(valor, w - 2) as string[];
    return 9 + Math.min(linhas.length, 4) * 4.2;
  };

  const pintarCampo = (
    x: number,
    y0: number,
    w: number,
    rotulo: string,
    valor: string,
  ) => {
    doc.setTextColor(...C_MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(rotulo.toUpperCase(), x, y0);
    doc.setTextColor(...C_TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const linhas = doc.splitTextToSize(valor, w - 2) as string[];
    let yy = y0 + 4.5;
    for (const ln of linhas.slice(0, 4)) {
      doc.text(ln, x, yy);
      yy += 4.2;
    }
  };

  const caixaCampo = (
    x: number,
    y0: number,
    w: number,
    h: number,
    rotulo: string,
    valor: string,
  ) => {
    doc.setFillColor(...C_CARD);
    doc.setDrawColor(...C_BORDER);
    doc.roundedRect(x, y0, w, h, 1.5, 1.5, "FD");
    pintarCampo(x + pad, y0 + pad, w - pad * 2, rotulo, valor);
  };

  for (const secao of secoes) {
    ensure(14);
    doc.setTextColor(...C_TITLE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(secao.titulo, MARGIN, y);
    y += 3;
    doc.setDrawColor(...C_BRAND);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN + 32, y);
    doc.setLineWidth(0.2);
    y += 5;

    const campos = secao.campos;
    for (let i = 0; i < campos.length; i++) {
      const c = campos[i];
      const larguraInteira =
        c.largura === "inteira" ||
        i === campos.length - 1 ||
        campos[i + 1]?.largura === "inteira";

      if (larguraInteira) {
        const h = alturaCampo(c.valor, contentW - pad * 2);
        ensure(h + 4);
        caixaCampo(MARGIN, y, contentW, h, c.rotulo, c.valor);
        y += h + 4;
        continue;
      }

      const c2 = campos[i + 1];
      const h1 = alturaCampo(c.valor, colW - pad * 2);
      const h2 = alturaCampo(c2.valor, colW - pad * 2);
      const boxH = Math.max(h1, h2);
      ensure(boxH + 4);
      caixaCampo(MARGIN, y, colW, boxH, c.rotulo, c.valor);
      caixaCampo(MARGIN + colW + gapCol, y, colW, boxH, c2.rotulo, c2.valor);
      y += boxH + 4;
      i += 1;
    }
    y += 4;
  }

  // —— Aviso legal ——
  ensure(22);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...C_BORDER);
  doc.roundedRect(MARGIN, y, contentW, 18, 2, 2, "FD");
  doc.setTextColor(...C_MUTED);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  const aviso =
    "Documento gerado automaticamente a partir do cadastro no Hub Mestre. " +
    "Serve como referência operacional e não substitui o instrumento contratual assinado entre as partes.";
  const avisoLinhas = doc.splitTextToSize(aviso, contentW - 8) as string[];
  let ay = y + 6;
  for (const ln of avisoLinhas) {
    doc.text(ln, MARGIN + 4, ay);
    ay += 3.8;
  }

  rodape();
  return doc;
}

/** Gera e baixa o PDF do contrato. */
export function baixarContratoClientePdf(cliente: ClienteApi): void {
  const doc = gerarPDFContratoCliente(cliente);
  doc.save(`contrato-${slugArquivo(cliente.nome, cliente.uf)}.pdf`);
}
