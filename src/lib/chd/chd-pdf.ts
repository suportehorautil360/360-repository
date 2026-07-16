import { jsPDF } from "jspdf";
import type { ChdDocCompleto } from "../api/checklist-devolucao";
import {
  labelCombustivelChd,
  labelItemChd,
  labelModuloSecao,
  labelStatusChdExport,
  secaoModuloChd,
} from "./chd-checklist-labels";
import {
  carregarMapaImagensChd,
  coletarUrlsFotosChd,
  dimensaoImagemPdf,
  formatImagemPdf,
  type ImagemPdfCarregada,
} from "./chd-pdf-images";

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const NAVY: [number, number, number] = [15, 35, 72];
const ORANGE: [number, number, number] = [249, 115, 22];
const GREEN: [number, number, number] = [22, 163, 74];
const RED: [number, number, number] = [220, 38, 38];
const GRAY: [number, number, number] = [148, 163, 184];

function v(val?: string | null): string {
  return val?.trim() ? val.trim() : "—";
}

function fileSafe(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

function quebraPagina(doc: jsPDF, y: number, need = 12): number {
  if (y + need > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN + 4;
  }
  return y;
}

function desenharCabecalho(
  doc: jsPDF,
  opts: {
    number: string;
    os?: string;
    status: string;
    oficina?: string;
    data?: string;
  },
): number {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 36, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 36, PAGE_W, 2.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("HORA ÚTIL 360 · PORTAL PREFEITURA", MARGIN, 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CHD — Checklist de Devolução", MARGIN, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(opts.number, PAGE_W - MARGIN, 14, { align: "right" });
  if (opts.os) {
    doc.text(`O.S. ${opts.os}`, PAGE_W - MARGIN, 20, { align: "right" });
  }

  const y = 44;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 14, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 14, 2, 2, "S");

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const chips = [
    `Status: ${opts.status}`,
    opts.data ? `Data: ${opts.data}` : null,
    opts.oficina ? `Oficina: ${opts.oficina}` : null,
  ].filter(Boolean) as string[];

  let cx = MARGIN + 4;
  for (const chip of chips) {
    doc.text(chip, cx, y + 9);
    cx += doc.getTextWidth(chip) + 14;
  }

  return y + 20;
}

function desenharTituloSecao(
  doc: jsPDF,
  y: number,
  numero: number,
  titulo: string,
): number {
  y = quebraPagina(doc, y, 14);
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 8, 1.5, 1.5, "F");
  doc.setFillColor(...ORANGE);
  doc.circle(MARGIN + 5, y + 4, 2.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`${numero}. ${titulo.toUpperCase()}`, MARGIN + 10, y + 5.5);
  doc.setFont("helvetica", "normal");
  return y + 12;
}

function desenharPar(
  doc: jsPDF,
  y: number,
  rotulo: string,
  valor: string,
): number {
  y = quebraPagina(doc, y, 8);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(rotulo, MARGIN + 2, y);
  doc.setTextColor(30, 41, 59);
  const linhas = doc.splitTextToSize(valor, PAGE_W - MARGIN * 2 - 52) as string[];
  linhas.forEach((ln, i) => {
    if (i > 0) y = quebraPagina(doc, y + 4.5, 6);
    doc.text(ln, MARGIN + 48, y);
    if (i < linhas.length - 1) y += 4.5;
  });
  doc.setDrawColor(241, 245, 249);
  doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
  return y + 7;
}

function desenharMarcadorCheck(
  doc: jsPDF,
  x: number,
  y: number,
  status: string,
): void {
  const colW = 10;
  const cols = { ok: x, anomaly: x + colW, na: x + colW * 2 };

  const drawMark = (cx: number, active: boolean, kind: "ok" | "bad" | "na") => {
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y - 3.5, 7, 5, 1, 1, "S");
    if (!active) return;
    if (kind === "ok") {
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      doc.text("✓", cx + 1.8, y);
    } else if (kind === "bad") {
      doc.setTextColor(...RED);
      doc.setFont("helvetica", "bold");
      doc.text("!", cx + 2.2, y);
    } else {
      doc.setTextColor(...GRAY);
      doc.text("—", cx + 1.6, y);
    }
    doc.setFont("helvetica", "normal");
  };

  drawMark(cols.ok, status === "ok", "ok");
  drawMark(cols.anomaly, status === "anomaly", "bad");
  drawMark(cols.na, status === "na", "na");
}

function desenharCabecalhoChecks(doc: jsPDF, y: number): number {
  y = quebraPagina(doc, y, 10);
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 6, "F");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM", MARGIN + 2, y + 4);
  doc.text("OK", PAGE_W - MARGIN - 28, y + 4);
  doc.text("A", PAGE_W - MARGIN - 18, y + 4);
  doc.text("NA", PAGE_W - MARGIN - 8, y + 4);
  doc.setFont("helvetica", "normal");
  return y + 8;
}

function desenharLinhaCheck(
  doc: jsPDF,
  y: number,
  item: string,
  status: string,
): number {
  y = quebraPagina(doc, y, 8);
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const linhas = doc.splitTextToSize(item, PAGE_W - MARGIN * 2 - 38) as string[];
  doc.text(linhas[0] ?? item, MARGIN + 2, y);
  desenharMarcadorCheck(doc, PAGE_W - MARGIN - 30, y, status);
  doc.setDrawColor(241, 245, 249);
  doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
  let ny = y + 5;
  for (let i = 1; i < linhas.length; i++) {
    ny = quebraPagina(doc, ny, 6);
    doc.text(linhas[i], MARGIN + 2, ny);
    ny += 4;
  }
  return ny + 2;
}

function desenharRodape(doc: jsPDF, y: number, linhas: string[]): void {
  y = quebraPagina(doc, y, 16);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  for (const ln of linhas) {
    doc.text(ln, MARGIN, y);
    y += 4;
  }
}

function desenharFoto(
  doc: jsPDF,
  y: number,
  rotulo: string,
  img: ImagemPdfCarregada,
  maxW = PAGE_W - MARGIN * 2,
  maxH = 44,
): number {
  const { w, h } = dimensaoImagemPdf(img, maxW, maxH);
  y = quebraPagina(doc, y, h + 10);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(rotulo, MARGIN + 2, y);
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, w + 2, h + 2, 1.5, 1.5, "S");
  doc.addImage(
    img.dataUrl,
    formatImagemPdf(img.dataUrl),
    MARGIN + 1,
    y + 1,
    w,
    h,
  );
  return y + h + 7;
}

function desenharFotoOuPlaceholder(
  doc: jsPDF,
  y: number,
  rotulo: string,
  url: string | undefined,
  imagens: Map<string, ImagemPdfCarregada | null>,
  maxW = PAGE_W - MARGIN * 2,
  maxH = 44,
): number {
  const trimmed = url?.trim();
  if (!trimmed) return y;

  const img = imagens.get(trimmed);
  if (img) {
    return desenharFoto(doc, y, rotulo, img, maxW, maxH);
  }

  y = quebraPagina(doc, y, 10);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(rotulo, MARGIN + 2, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Foto indisponível para impressão.", MARGIN + 2, y);
  return y + 8;
}

function desenharParFotosPeca(
  doc: jsPDF,
  y: number,
  rotuloNova: string,
  urlNova: string | undefined,
  rotuloVelha: string,
  urlVelha: string | undefined,
  imagens: Map<string, ImagemPdfCarregada | null>,
): number {
  const nova = urlNova?.trim();
  const velha = urlVelha?.trim();
  if (!nova && !velha) return y;

  const gap = 4;
  const colW = (PAGE_W - MARGIN * 2 - gap) / 2;
  const maxH = 40;

  const imgNova = nova ? imagens.get(nova) : null;
  const imgVelha = velha ? imagens.get(velha) : null;
  const dimNova = imgNova ? dimensaoImagemPdf(imgNova, colW, maxH) : null;
  const dimVelha = imgVelha ? dimensaoImagemPdf(imgVelha, colW, maxH) : null;
  const blockH =
    Math.max(dimNova?.h ?? (nova ? 8 : 0), dimVelha?.h ?? (velha ? 8 : 0)) + 8;

  y = quebraPagina(doc, y, blockH);

  const drawCol = (
    x: number,
    rotulo: string,
    url: string | undefined,
    img: ImagemPdfCarregada | null | undefined,
    dim: { w: number; h: number } | null,
  ) => {
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(rotulo, x, y);
    const top = y + 4;
    if (img && dim) {
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, top, dim.w + 1, dim.h + 1, 1, 1, "S");
      doc.addImage(
        img.dataUrl,
        formatImagemPdf(img.dataUrl),
        x + 0.5,
        top + 0.5,
        dim.w,
        dim.h,
      );
      return;
    }
    if (url) {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Indisponível", x, top + 4);
    }
  };

  drawCol(MARGIN, rotuloNova, nova, imgNova ?? null, dimNova);
  drawCol(MARGIN + colW + gap, rotuloVelha, velha, imgVelha ?? null, dimVelha);

  return y + blockH + 2;
}

export async function baixarChdPdf(
  chd: ChdDocCompleto,
  opts?: { oficinaNome?: string },
): Promise<void> {
  const imagens = await carregarMapaImagensChd(coletarUrlsFotosChd(chd));
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const id = chd.identification ?? {};
  let y = desenharCabecalho(doc, {
    number: chd.number,
    os: id.os,
    status: labelStatusChdExport(chd.status),
    oficina: opts?.oficinaNome?.trim() || chd.oficinaId,
    data: v(id.date) !== "—" ? id.date : undefined,
  });

  let secNum = 1;
  y = desenharTituloSecao(doc, y, secNum++, "Identificação");
  const paresId = [
    ["Equipamento", v(id.brandModel)],
    ["Placa / prefixo", v(id.platePrefix)],
    ["Horímetro", v(id.hourMeter)],
    ["KM", v(id.currentKm)],
    ["Condutor", v(id.driver)],
    ["Resp. técnico", v(id.technicalResponsible)],
    ["Combustível", labelCombustivelChd(id.fuel)],
    ["Hora", v(id.time)],
  ] as const;
  for (const [rotulo, valor] of paresId) {
    y = desenharPar(doc, y, rotulo, valor);
  }

  const generalItems = Object.entries(chd.generalState ?? {}).filter(
    ([, item]) => item?.status,
  );
  if (generalItems.length > 0) {
    y = desenharTituloSecao(doc, y, secNum++, "Estado geral");
    y = desenharCabecalhoChecks(doc, y);
    for (const [key, item] of generalItems) {
      y = desenharLinhaCheck(doc, y, labelItemChd(key), item.status ?? "");
      y = desenharFotoOuPlaceholder(
        doc,
        y,
        `Foto — ${labelItemChd(key)}`,
        item.photo,
        imagens,
      );
    }
  }

  const moduleGroups = new Map<string, { key: string; status: string }[]>();
  for (const [key, item] of Object.entries(chd.modules ?? {})) {
    if (!item?.status) continue;
    const titulo = labelModuloSecao(secaoModuloChd(key));
    const lista = moduleGroups.get(titulo) ?? [];
    lista.push({ key, status: item.status });
    moduleGroups.set(titulo, lista);
  }
  for (const [titulo, itens] of moduleGroups) {
    if (itens.length === 0) continue;
    y = desenharTituloSecao(doc, y, secNum++, titulo);
    y = desenharCabecalhoChecks(doc, y);
    for (const item of itens) {
      y = desenharLinhaCheck(doc, y, labelItemChd(item.key), item.status);
    }
  }

  const parts = chd.parts?.items ?? [];
  if (parts.length > 0) {
    y = desenharTituloSecao(doc, y, secNum++, "Peças substituídas");
    parts.forEach((part, index) => {
      y = desenharPar(doc, y, `Peça ${index + 1}`, v(part.description));
      y = desenharPar(doc, y, "Nº / marca", `${v(part.partNumber)} · ${v(part.brand)}`);
      y = desenharPar(doc, y, "Destino peça antiga", v(part.oldPartDestination));
      y = desenharParFotosPeca(
        doc,
        y,
        "Foto peça nova",
        part.newPhoto,
        "Foto peça substituída",
        part.replacedPhoto,
        imagens,
      );
    });
  }

  const services = chd.services?.items ?? [];
  if (services.length > 0) {
    y = desenharTituloSecao(doc, y, secNum++, "Serviços executados");
    services.forEach((svc, index) => {
      y = desenharPar(doc, y, `Serviço ${index + 1}`, v(svc.systemComponent));
      y = desenharPar(doc, y, "Diagnóstico", v(svc.initialDiagnosis));
      y = desenharPar(doc, y, "Ação técnica", v(svc.technicalAction));
      y = desenharPar(
        doc,
        y,
        "Técnico / horas",
        `${v(svc.technician)} · ${v(svc.manHours)} h`,
      );
    });
  }

  const closing = chd.closing;
  if (closing) {
    y = desenharTituloSecao(doc, y, secNum++, "Encerramento");
    y = desenharPar(
      doc,
      y,
      "Inventário de bordo",
      closing.inventoryChecked
        ? "✓  Conferido (macaco, triângulo, chave, estepe, CRLV)"
        : "✗  Não conferido",
    );
    y = desenharPar(doc, y, "Assinatura condutor", v(closing.driverSignature));
    y = desenharPar(doc, y, "Assinatura oficina", v(closing.workshopSignature));
  }

  desenharRodape(doc, y + 4, [
    "Documento oficial gerado pelo portal da prefeitura — Hora Útil 360.",
    chd.createdAt ? `Registrado em: ${chd.createdAt}` : "",
    "Legenda checks: ✓ OK  ·  ! Anomalia  ·  — N/A",
  ].filter(Boolean));

  doc.save(`${fileSafe(chd.number || chd.id)}.pdf`);
}
