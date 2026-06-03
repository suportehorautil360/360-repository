import { type Dispatch, type SetStateAction } from "react";
import { jsPDF } from "jspdf";
import seedData from "../../data/hu360OperadorSeed.json";
import { HU360_HIST_ITEM_LABELS } from "./checklistAppToHistoricoRow";
import { itensDaCategoria } from "../../features/checklist/domain/itens";
import { linkGoogleMaps } from "../../lib/geo/maps";
import "./checklistHistoricoLista.css";

function checklistCategoriaFromMaquina(catMaquina: string): string {
  if (catMaquina.startsWith("Caminhão")) return "Caminhões";
  return catMaquina;
}

function checklistItemLabelFromSeed(
  numKey: string,
  categoriaMaquina: string,
): string {
  const catRaw = String(categoriaMaquina ?? "");
  // Novo: chave sequencial (1..N) da MESMA lista usada na captura.
  const bySeq = itensDaCategoria(catRaw).find(
    (x) => String(x["Nº"]) === String(numKey),
  );
  if (bySeq) return String(bySeq["Item de Verificação"] ?? numKey);
  // Legado: a chave era o `Nº` original do seed (ex.: "1.1").
  const cat = checklistCategoriaFromMaquina(catRaw);
  const byOrig = seedData.itens_checklist.find((x) => {
    if (String(x["Nº"]) !== String(numKey)) return false;
    const aplicaA = (x as { "Aplica A"?: string[] })["Aplica A"];
    if (Array.isArray(aplicaA)) return aplicaA.includes(cat);
    return (x as { Categoria?: string }).Categoria === cat;
  });
  return byOrig ? String(byOrig["Item de Verificação"] ?? numKey) : `Item ${numKey}`;
}

export function sortChavesRespostasChecklist(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

/** Interpreta valor salvo em Respostas_JSON (legado ou objeto). */
export function parseRespostaChecklistItemUi(val: unknown): {
  ok: boolean;
  na: boolean;
  label: "Sim" | "Não" | "N/A";
  tone: "sim" | "nao" | "na";
  problema?: string;
  fotoProblema?: string;
} {
  if (val === "sim") return { ok: true, na: false, label: "Sim", tone: "sim" };
  if (val === "nao")
    return { ok: false, na: false, label: "Não", tone: "nao" };
  if (val === "na") return { ok: false, na: true, label: "N/A", tone: "na" };
  if (val && typeof val === "object" && "v" in val) {
    const o = val as { v?: string; foto?: string; problema?: string };
    if (o.v === "sim")
      return { ok: true, na: false, label: "Sim", tone: "sim" };
    if (o.v === "na")
      return { ok: false, na: true, label: "N/A", tone: "na" };
    if (o.v === "nao") {
      const foto =
        typeof o.foto === "string" && o.foto.startsWith("data:image")
          ? o.foto
          : undefined;
      return {
        ok: false,
        na: false,
        label: "Não",
        tone: "nao",
        problema: typeof o.problema === "string" ? o.problema : "",
        fotoProblema: foto,
      };
    }
  }
  return { ok: false, na: false, label: "Não", tone: "nao" };
}

function readItemLabels(
  row: Record<string, unknown>,
): Record<string, string> | undefined {
  const v = row[HU360_HIST_ITEM_LABELS];
  if (typeof v !== "string" || !v.trim()) return undefined;
  try {
    const o = JSON.parse(v) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
    return o as Record<string, string>;
  } catch {
    return undefined;
  }
}

function formatDataHoraCell(raw: string): string {
  const s = String(raw ?? "");
  if (!s) return "—";
  // O timestamp é gravado em ISO/UTC; exibe no fuso local (não cortar a string).
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 19).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fileSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

function construirChecklistPdf(
  row: Record<string, unknown>,
  entradas: [string, unknown][],
  itemLabelMap: Record<string, string> | undefined,
  catMaquina: string,
): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 12;
  const maxWidth = pageWidth - left * 2;
  const cBrand: [number, number, number] = [234, 88, 12];
  const cTitle: [number, number, number] = [15, 23, 42];
  const cText: [number, number, number] = [51, 65, 85];
  const cMuted: [number, number, number] = [100, 116, 139];
  let y = 0;

  const drawHeader = (continuacao = false) => {
    doc.setFillColor(...cBrand);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("HORA UTIL 360", left, 9);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      continuacao
        ? "Relatorio de Checklist (continuacao)"
        : "Relatorio de Checklist",
      left,
      15,
    );
    y = 30;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 14) return;
    doc.addPage();
    drawHeader(true);
  };

  const sectionTitle = (title: string) => {
    ensureSpace(10);
    doc.setTextColor(...cTitle);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, left, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(left, y, left + maxWidth, y);
    y += 5;
  };

  const labelValue = (label: string, value: string) => {
    ensureSpace(9);
    doc.setTextColor(...cMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(label, left, y);
    y += 4;
    doc.setTextColor(...cText);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value || "-", maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(5.2);
      doc.text(line, left, y);
      y += 5.2;
    });
  };

  const textBlock = (text: string) => {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    doc.setTextColor(...cText);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.6);
    lines.forEach((line) => {
      ensureSpace(5);
      doc.text(line, left, y);
      y += 5;
    });
  };

  const addImage = (dataUrl: string, widthMm: number, heightMm: number) => {
    ensureSpace(heightMm + 4);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(
      left - 1.5,
      y - 1.5,
      widthMm + 3,
      heightMm + 3,
      1.5,
      1.5,
      "S",
    );
    doc.addImage(
      dataUrl,
      imageFormatFromDataUrl(dataUrl),
      left,
      y,
      widthMm,
      heightMm,
    );
    y += heightMm + 5;
  };

  drawHeader();

  const totalSim = entradas.filter(
    ([, val]) => parseRespostaChecklistItemUi(val).ok,
  ).length;
  const totalNa = entradas.filter(
    ([, val]) => parseRespostaChecklistItemUi(val).na,
  ).length;
  const totalNao = entradas.length - totalSim - totalNa;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(left, y, maxWidth, 23, 2, 2, "F");
  y += 6;
  doc.setTextColor(...cMuted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Data/Hora", left + 3, y);
  doc.text("Operador", left + 68, y);
  doc.text("Status", left + 133, y);
  y += 4.4;
  doc.setTextColor(...cTitle);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(formatDataHoraCell(String(row.Data_Hora ?? "")), left + 3, y);
  doc.text(String(row.Operador ?? "-"), left + 68, y);
  doc.text(String(row.Status_Ok_Nao ?? "-"), left + 133, y);
  y += 7;
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(9.5);
  doc.text(`Sim: ${totalSim}`, left + 3, y);
  doc.setTextColor(153, 27, 27);
  doc.text(`Nao: ${totalNao}`, left + 28, y);
  doc.setTextColor(71, 85, 105);
  doc.text(`N/A: ${totalNa}`, left + 54, y);
  y += 10;

  sectionTitle("Dados do equipamento");
  labelValue("Chassi", String(row.Chassis ?? "-"));
  labelValue("Horimetro", String(row.Horimetro_Final ?? "-"));

  const obs = String(row.Obs ?? "").trim();
  if (obs) {
    sectionTitle("Observacoes");
    textBlock(obs);
  }

  const assinatura = String(row.Assinatura_Operador ?? "");
  if (assinatura.startsWith("data:image")) {
    sectionTitle("Assinatura do operador");
    addImage(assinatura, 80, 32);
  }

  const fotoHorimetro = String(row.Foto_Horimetro ?? "");
  if (fotoHorimetro.startsWith("data:image")) {
    sectionTitle("Foto do horimetro");
    addImage(fotoHorimetro, 90, 54);
  }

  sectionTitle("Itens verificados");
  entradas.forEach(([k, val]) => {
    const u = parseRespostaChecklistItemUi(val);
    const lbl = itemLabelMap?.[k] ?? checklistItemLabelFromSeed(k, catMaquina);
    const problemaTexto = (u.problema ?? "").trim();
    const hasFoto = Boolean(
      u.fotoProblema && u.fotoProblema.startsWith("data:image"),
    );
    const hasProblema = Boolean(problemaTexto);
    const itemHeight = u.ok || u.na ? 10 : 12;
    ensureSpace(itemHeight);
    if (u.ok) doc.setFillColor(236, 253, 245);
    else if (u.na) doc.setFillColor(241, 245, 249);
    else doc.setFillColor(254, 242, 242);
    doc.roundedRect(left, y - 3.8, maxWidth, itemHeight, 1.6, 1.6, "F");
    if (u.ok) doc.setFillColor(34, 197, 94);
    else if (u.na) doc.setFillColor(100, 116, 139);
    else doc.setFillColor(220, 38, 38);
    doc.rect(left, y - 3.8, 2.2, itemHeight, "F");
    doc.setTextColor(...cTitle);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.4);
    const tag = u.label.toUpperCase();
    const head = `[${k}] ${lbl}`;
    const headLines = doc.splitTextToSize(head, maxWidth - 18) as string[];
    doc.text(headLines[0] ?? head, left + 4, y + 0.4);
    if (u.ok) doc.setTextColor(22, 101, 52);
    else if (u.na) doc.setTextColor(71, 85, 105);
    else doc.setTextColor(153, 27, 27);
    doc.text(tag, left + maxWidth - 13, y + 0.4);
    y += 5;

    if (!u.ok && !u.na && hasFoto && u.fotoProblema) {
      ensureSpace(3);
      y += 1;
      addImage(u.fotoProblema, 78, 50);
    }

    if (!u.ok && !u.na && hasProblema) {
      doc.setTextColor(...cText);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const pLines = doc.splitTextToSize(
        `Problema: ${problemaTexto}`,
        maxWidth - 6,
      ) as string[];
      pLines.forEach((line) => {
        ensureSpace(4.5);
        doc.text(line, left + 4, y);
        y += 4.5;
      });
    }
    y += 2;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...cMuted);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    left,
    pageHeight - 8,
  );

  const dataRef = String(row.Data_Hora ?? "").slice(0, 10);
  const operadorRef = String(row.Operador ?? "operador");
  const registroRef = String(row.ID_Registro ?? row.ID_Maquina ?? "registro");
  const fileName = `checklist-${fileSafe(dataRef || "sem-data")}-${fileSafe(operadorRef || "operador")}-${fileSafe(registroRef || "registro")}.pdf`;
  return { blob: doc.output("blob") as Blob, fileName };
}

export function gerarChecklistPdf(
  row: Record<string, unknown>,
  entradas: [string, unknown][],
  itemLabelMap: Record<string, string> | undefined,
  catMaquina: string,
) {
  try {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 12;
    const maxWidth = pageWidth - left * 2;
    const cBrand: [number, number, number] = [234, 88, 12];
    const cTitle: [number, number, number] = [15, 23, 42];
    const cText: [number, number, number] = [51, 65, 85];
    const cMuted: [number, number, number] = [100, 116, 139];
    let y = 0;

    const drawHeader = (continuacao = false) => {
      doc.setFillColor(...cBrand);
      doc.rect(0, 0, pageWidth, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("HORA UTIL 360", left, 9);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        continuacao
          ? "Relatorio de Checklist (continuacao)"
          : "Relatorio de Checklist",
        left,
        15,
      );
      y = 30;
    };

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - 14) return;
      doc.addPage();
      drawHeader(true);
    };

    const sectionTitle = (title: string) => {
      ensureSpace(10);
      doc.setTextColor(...cTitle);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, left, y);
      y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.line(left, y, left + maxWidth, y);
      y += 5;
    };

    const labelValue = (label: string, value: string) => {
      ensureSpace(9);
      doc.setTextColor(...cMuted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(label, left, y);
      y += 4;
      doc.setTextColor(...cText);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(value || "-", maxWidth) as string[];
      lines.forEach((line) => {
        ensureSpace(5.2);
        doc.text(line, left, y);
        y += 5.2;
      });
    };

    const textBlock = (text: string) => {
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      doc.setTextColor(...cText);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.6);
      lines.forEach((line) => {
        ensureSpace(5);
        doc.text(line, left, y);
        y += 5;
      });
    };

    const addImage = (dataUrl: string, widthMm: number, heightMm: number) => {
      ensureSpace(heightMm + 4);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(
        left - 1.5,
        y - 1.5,
        widthMm + 3,
        heightMm + 3,
        1.5,
        1.5,
        "S",
      );
      doc.addImage(
        dataUrl,
        imageFormatFromDataUrl(dataUrl),
        left,
        y,
        widthMm,
        heightMm,
      );
      y += heightMm + 5;
    };

    drawHeader();

    const totalSim = entradas.filter(
      ([, val]) => parseRespostaChecklistItemUi(val).ok,
    ).length;
    const totalNa = entradas.filter(
      ([, val]) => parseRespostaChecklistItemUi(val).na,
    ).length;
    const totalNao = entradas.length - totalSim - totalNa;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(left, y, maxWidth, 23, 2, 2, "F");
    y += 6;
    doc.setTextColor(...cMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Data/Hora", left + 3, y);
    doc.text("Operador", left + 68, y);
    doc.text("Status", left + 133, y);
    y += 4.4;
    doc.setTextColor(...cTitle);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(formatDataHoraCell(String(row.Data_Hora ?? "")), left + 3, y);
    doc.text(String(row.Operador ?? "-"), left + 68, y);
    doc.text(String(row.Status_Ok_Nao ?? "-"), left + 133, y);
    y += 7;
    doc.setTextColor(22, 101, 52);
    doc.setFontSize(9.5);
    doc.text(`Sim: ${totalSim}`, left + 3, y);
    doc.setTextColor(153, 27, 27);
    doc.text(`Nao: ${totalNao}`, left + 28, y);
    doc.setTextColor(71, 85, 105);
    doc.text(`N/A: ${totalNa}`, left + 54, y);
    y += 10;

    sectionTitle("Dados do equipamento");
    labelValue("Chassi", String(row.Chassis ?? "-"));
    labelValue("Horimetro", String(row.Horimetro_Final ?? "-"));

    const obs = String(row.Obs ?? "").trim();

    if (obs) {
      sectionTitle("Observacoes");
      textBlock(obs);
    }

    const assinatura = String(row.Assinatura_Operador ?? "");
    if (assinatura.startsWith("data:image")) {
      sectionTitle("Assinatura do operador");
      addImage(assinatura, 80, 32);
    }

    const fotoHorimetro = String(row.Foto_Horimetro ?? "");
    if (fotoHorimetro.startsWith("data:image")) {
      sectionTitle("Foto do horimetro");
      addImage(fotoHorimetro, 90, 54);
    }

    sectionTitle("Itens verificados");
    entradas.forEach(([k, val]) => {
      const u = parseRespostaChecklistItemUi(val);
      const lbl =
        itemLabelMap?.[k] ?? checklistItemLabelFromSeed(k, catMaquina);
      const problemaTexto = (u.problema ?? "").trim();
      const hasFoto = Boolean(
        u.fotoProblema && u.fotoProblema.startsWith("data:image"),
      );
      const hasProblema = Boolean(problemaTexto);
      const itemHeight = u.ok || u.na ? 10 : 12;
      ensureSpace(itemHeight);
      if (u.ok) doc.setFillColor(236, 253, 245);
      else if (u.na) doc.setFillColor(241, 245, 249);
      else doc.setFillColor(254, 242, 242);
      doc.roundedRect(left, y - 3.8, maxWidth, itemHeight, 1.6, 1.6, "F");
      if (u.ok) doc.setFillColor(34, 197, 94);
      else if (u.na) doc.setFillColor(100, 116, 139);
      else doc.setFillColor(220, 38, 38);
      doc.rect(left, y - 3.8, 2.2, itemHeight, "F");
      doc.setTextColor(...cTitle);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.4);
      const tag = u.label.toUpperCase();
      const head = `[${k}] ${lbl}`;
      const headLines = doc.splitTextToSize(head, maxWidth - 18) as string[];
      doc.text(headLines[0] ?? head, left + 4, y + 0.4);
      if (u.ok) doc.setTextColor(22, 101, 52);
      else if (u.na) doc.setTextColor(71, 85, 105);
      else doc.setTextColor(153, 27, 27);
      doc.text(tag, left + maxWidth - 13, y + 0.4);
      y += 5;

      if (!u.ok && !u.na && hasFoto && u.fotoProblema) {
        ensureSpace(3);
        y += 1;
        addImage(u.fotoProblema, 78, 50);
      }

      if (!u.ok && !u.na && hasProblema) {
        doc.setTextColor(...cText);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const pLines = doc.splitTextToSize(
          `Problema: ${problemaTexto}`,
          maxWidth - 6,
        ) as string[];
        pLines.forEach((line) => {
          ensureSpace(4.5);
          doc.text(line, left + 4, y);
          y += 4.5;
        });
      }
      y += 2;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...cMuted);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      left,
      pageHeight - 8,
    );

    const dataRef = String(row.Data_Hora ?? "").slice(0, 10);
    const operadorRef = String(row.Operador ?? "operador");
    const nome = `checklist-${fileSafe(dataRef || "sem-data")}-${fileSafe(operadorRef || "operador")}.pdf`;
    doc.save(nome);
  } catch (err) {
    console.error("[ChecklistHistorico] Erro ao gerar PDF:", err);
    alert("Nao foi possivel gerar o PDF deste checklist.");
  }
}

export function baixarChecklistPdfs(rows: Record<string, unknown>[]) {
  rows.forEach((row, idx) => {
    const rj = row.Respostas_JSON;
    const itemLabelMap = readItemLabels(row);
    const catMaquina = String(row.Categoria ?? "");
    let entradas: [string, unknown][] = [];
    if (typeof rj === "string" && rj) {
      try {
        const o = JSON.parse(rj) as Record<string, unknown>;
        entradas = sortChavesRespostasChecklist(Object.keys(o)).map((k) => [
          k,
          o[k],
        ]);
      } catch {
        entradas = [];
      }
    }
    gerarChecklistPdf(row, entradas, itemLabelMap, catMaquina);
    if (idx < rows.length - 1) {
      // Permite que o navegador processe downloads consecutivos sem engasgar.
      // O clique do usuário já autoriza a sequência.
    }
  });
}

export async function baixarChecklistPdfsEmPasta(
  rows: Record<string, unknown>[],
) {
  const pickerWindow = window as Window & {
    showDirectoryPicker?: (options?: {
      mode?: "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  };

  if (!pickerWindow.showDirectoryPicker) {
    alert(
      "Seu navegador não suporta salvar em pasta. Use um navegador Chromium ou baixe os PDFs individualmente.",
    );
    return;
  }

  try {
    const raiz = await pickerWindow.showDirectoryPicker({ mode: "readwrite" });
    const pasta = raiz;

    for (const row of rows) {
      const rj = row.Respostas_JSON;
      const itemLabelMap = readItemLabels(row);
      const catMaquina = String(row.Categoria ?? "");
      let entradas: [string, unknown][] = [];
      if (typeof rj === "string" && rj) {
        try {
          const o = JSON.parse(rj) as Record<string, unknown>;
          entradas = sortChavesRespostasChecklist(Object.keys(o)).map((k) => [
            k,
            o[k],
          ]);
        } catch {
          entradas = [];
        }
      }

      const { blob, fileName } = construirChecklistPdf(
        row,
        entradas,
        itemLabelMap,
        catMaquina,
      );

      const fileHandle = await pasta.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }

    alert("PDFs salvos na pasta escolhida.");
  } catch (err) {
    console.error("[ChecklistHistorico] Erro ao salvar PDFs em pasta:", err);
    alert("Nao foi possivel salvar os PDFs na pasta escolhida.");
  }
}

export function ListaChecklistHistoricoLocal({
  rows,
  expandidoId,
  setExpandidoId,
  mensagemVazia,
  permitirDownloadPdf = false,
}: {
  rows: Record<string, unknown>[];
  expandidoId: string | null;
  setExpandidoId: Dispatch<SetStateAction<string | null>>;
  mensagemVazia: string;
  permitirDownloadPdf?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: "#64748b", fontSize: "0.92rem" }}>
        {mensagemVazia}
      </p>
    );
  }
  return (
    <ul className="hu360-dash-chk-list">
      {rows.map((row, idx) => {
        const id = String(row.ID_Registro ?? `sem-id-${idx}`);
        const exp = expandidoId === id;
        const catMaquina = String(row.Categoria ?? "");
        const itemLabelMap = readItemLabels(row);
        let entradas: [string, unknown][] = [];
        const rj = row.Respostas_JSON;
        if (typeof rj === "string" && rj) {
          try {
            const o = JSON.parse(rj) as Record<string, unknown>;
            entradas = sortChavesRespostasChecklist(Object.keys(o)).map((k) => [
              k,
              o[k],
            ]);
          } catch {
            entradas = [];
          }
        }
        return (
          <li key={id} className="hu360-dash-chk-list__item">
            <div className="hu360-dash-chk-list__row">
              <div>
                <strong>
                  {formatDataHoraCell(String(row.Data_Hora ?? ""))}
                </strong>
                <span className="hu360-dash-chk-list__meta">
                  {" · "}
                  {String(row.Operador ?? "—")} ·{" "}
                  {String(row.Status_Ok_Nao ?? "")}
                </span>
              </div>
              <div className="hu360-dash-chk-list__actions">
                <button
                  type="button"
                  className="hu360-btn hu360-btn-ghost hu360-dash-chk-list__ver"
                  onClick={() =>
                    setExpandidoId((cur) => (cur === id ? null : id))
                  }
                >
                  {exp ? "Ocultar" : "Ver checklist"}
                </button>
                {permitirDownloadPdf ? (
                  <button
                    type="button"
                    className="hu360-btn hu360-btn-ghost hu360-dash-chk-list__ver"
                    onClick={() =>
                      gerarChecklistPdf(row, entradas, itemLabelMap, catMaquina)
                    }
                  >
                    Baixar PDF
                  </button>
                ) : null}
              </div>
            </div>
            {exp ? (
              <div className="hu360-dash-chk-detail">
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "0.88rem",
                    color: "#334155",
                  }}
                >
                  <strong>{String(row.ID_Maquina ?? "")}</strong> ·{" "}
                  {String(row.Marca ?? "")} {String(row.Modelo ?? "")} · Chassi{" "}
                  <strong>{String(row.Chassis ?? "—")}</strong>
                </p>
                <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
                  Horímetro:{" "}
                  <strong>{String(row.Horimetro_Final ?? "—")}</strong>
                </p>
                {typeof row.Localizacao_GPS === "string" &&
                row.Localizacao_GPS.trim() ? (
                  <p style={{ margin: "0 0 8px", fontSize: "0.88rem" }}>
                    📍 Localização:{" "}
                    <a
                      href={linkGoogleMaps(row.Localizacao_GPS)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#2563eb", fontWeight: 600 }}
                    >
                      {row.Localizacao_GPS}
                    </a>
                  </p>
                ) : null}
                {typeof row.Foto_Horimetro === "string" &&
                row.Foto_Horimetro.startsWith("data:image") ? (
                  <div className="hu360-dash-chk-detail__hori">
                    <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                      Foto do horímetro
                    </span>
                    <img src={row.Foto_Horimetro} alt="" />
                  </div>
                ) : null}
                {typeof row.Assinatura_Operador === "string" &&
                row.Assinatura_Operador.startsWith("data:image") ? (
                  <div className="hu360-dash-chk-detail__hori">
                    <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                      Assinatura do operador
                    </span>
                    <img
                      src={row.Assinatura_Operador}
                      alt="Assinatura do operador"
                    />
                  </div>
                ) : null}
                {typeof row.Obs === "string" && row.Obs.trim() ? (
                  <p style={{ margin: "10px 0 0", fontSize: "0.86rem" }}>
                    <strong>Obs.:</strong> {row.Obs}
                  </p>
                ) : null}
                <h4 style={{ margin: "16px 0 8px", fontSize: "0.95rem" }}>
                  Itens
                </h4>
                <ul className="hu360-dash-chk-itens">
                  {entradas.map(([k, val]) => {
                    const u = parseRespostaChecklistItemUi(val);
                    const lbl =
                      itemLabelMap?.[k] ??
                      checklistItemLabelFromSeed(k, catMaquina);
                    return (
                      <li
                        key={k}
                        className={`hu360-dash-chk-itens__li is-${u.tone}`}
                      >
                        <div className="hu360-dash-chk-itens__top">
                          <span className="hu360-dash-chk-itens__n">{k}</span>
                          <span className="hu360-dash-chk-itens__lbl">
                            {lbl}
                          </span>
                          <span
                            className={`hu360-dash-chk-itens__tag is-${u.tone}`}
                          >
                            {u.label}
                          </span>
                        </div>
                        {!u.ok &&
                        !u.na &&
                        (u.problema?.trim() || u.fotoProblema) ? (
                          <div className="hu360-dash-chk-itens__nao">
                            {u.fotoProblema ? (
                              <img
                                src={u.fotoProblema}
                                alt=""
                                className="hu360-dash-chk-itens__foto"
                              />
                            ) : null}
                            {u.problema?.trim() ? (
                              <p
                                style={{
                                  margin: "6px 0 0",
                                  fontSize: "0.84rem",
                                }}
                              >
                                {u.problema}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
