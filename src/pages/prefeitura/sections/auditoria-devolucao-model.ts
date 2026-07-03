export interface OrdemDevolucaoRaw {
  id: string;
  protocolo: string;
  solicitacaoOsId: string | null;
  equipamento: string;
  defeito: string;
  oficinaNome?: string;
  oficinaId?: string;
  valorTotal: number;
  status: string;
  criadoEm: { seconds: number } | null;
}

export interface SolicitacaoOsRaw {
  id: string;
  protocolo: string;
  linha: string;
  equipamento: string;
}

export interface LinhaAuditoriaDevolucao {
  osId: string;
  equipamento: string;
  classificacao: string;
  protocolo: string;
  oficina: string;
  defeito: string;
  valor: number;
  dataIso: string;
  status: string;
}

export const STATUS_OS_OPCOES = [
  { value: "todos", label: "Todos" },
  { value: "aprovado", label: "Aprovado" },
  { value: "aguardando_orcamento", label: "Aguardando Orçamento" },
  { value: "concluido", label: "Concluído" },
] as const;

const STATUS_LABEL_EXTRA: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  recusado: "Recusado",
};

export function labelStatusOs(status: string): string {
  return (
    STATUS_OS_OPCOES.find((s) => s.value === status)?.label ??
    STATUS_LABEL_EXTRA[status] ??
    status.replace(/_/g, " ")
  );
}

export interface ObservacaoAuditoriaFormatada {
  titulo: string | null;
  itens: string[];
  resumo: string;
  exportText: string;
  ehLista: boolean;
}

/** Normaliza relato longo (preventivo ou texto com bullets) para exibição e export. */
export function formatarObservacaoAuditoria(
  texto: string,
): ObservacaoAuditoriaFormatada {
  const bruto = texto?.trim() || "—";
  if (bruto === "—") {
    return {
      titulo: null,
      itens: [],
      resumo: "—",
      exportText: "—",
      ehLista: false,
    };
  }

  let titulo: string | null = null;
  let corpo = bruto;

  const tituloPreventiva = /^Manutenção preventiva\s*—\s*[^\n•]+/i.exec(bruto);
  if (tituloPreventiva) {
    titulo = tituloPreventiva[0].trim();
    corpo = bruto.slice(tituloPreventiva[0].length).trim().replace(/^[\n•\s]+/, "");
  }

  const itens = extrairItensObservacao(corpo);
  if (itens.length === 0) {
    return {
      titulo,
      itens: [],
      resumo: bruto,
      exportText: bruto,
      ehLista: false,
    };
  }

  const resumo = titulo
    ? `${titulo} · ${itens.length} item${itens.length === 1 ? "" : "ns"}`
    : `${itens.length} item${itens.length === 1 ? "" : "ns"}`;

  const linhas = [
    ...(titulo ? [titulo] : []),
    ...itens.map((item) => `• ${item}`),
  ];

  return {
    titulo,
    itens,
    resumo,
    exportText: linhas.join("\n"),
    ehLista: true,
  };
}

function extrairItensObservacao(corpo: string): string[] {
  const texto = corpo.trim();
  if (!texto) return [];

  if (texto.includes("\n")) {
    return texto
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((linha) => linha.replace(/^•\s*/, "").trim())
      .filter(Boolean);
  }

  if (/\s•\s/.test(texto)) {
    return texto
      .split(/\s•\s/)
      .map((item) => item.replace(/^•\s*/, "").trim())
      .filter(Boolean);
  }

  if (texto.startsWith("•")) {
    return [texto.replace(/^•\s*/, "").trim()].filter(Boolean);
  }

  return [];
}

export interface LinhaAuditoriaTela {
  dataLabel: string;
  tipoLabel: string;
  destino: string;
  valorLabel: string;
  responsavel: string;
  observacao: string;
  observacaoFmt: ObservacaoAuditoriaFormatada;
}

export function montarDestinoAuditoria(linha: LinhaAuditoriaDevolucao): string {
  const protocolo = linha.protocolo?.trim() || "—";
  const equipamento = linha.equipamento?.trim() || "—";
  if (protocolo === "—" && equipamento === "—") return "—";
  if (protocolo === "—") return equipamento;
  if (equipamento === "—") return protocolo;
  return `${protocolo} — ${equipamento}`;
}

export function fmtValorExportAuditoria(valor: number): string {
  if (!valor || valor <= 0) return "—";
  return `+ ${fmtBRL(valor)}`;
}

export function linhaAuditoriaParaTela(
  linha: LinhaAuditoriaDevolucao,
): LinhaAuditoriaTela {
  const observacaoFmt = formatarObservacaoAuditoria(linha.defeito?.trim() || "—");
  return {
    dataLabel: fmtDataBr(linha.dataIso),
    tipoLabel: labelStatusOs(linha.status),
    destino: montarDestinoAuditoria(linha),
    valorLabel: fmtValorExportAuditoria(linha.valor),
    responsavel: linha.oficina?.trim() || "—",
    observacao: observacaoFmt.exportText,
    observacaoFmt,
  };
}

export function fmtDataBr(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function timestampParaIso(ts: { seconds: number } | null): string {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function montarLinhasAuditoria(
  ordens: OrdemDevolucaoRaw[],
  solicitacoes: SolicitacaoOsRaw[],
): LinhaAuditoriaDevolucao[] {
  const solPorId = new Map(solicitacoes.map((s) => [s.id, s]));

  return ordens
    .map((o) => {
      const sol = o.solicitacaoOsId
        ? solPorId.get(o.solicitacaoOsId)
        : undefined;
      return {
        osId: o.id,
        equipamento: o.equipamento || sol?.equipamento || "—",
        classificacao: sol?.linha?.trim() || "—",
        protocolo: o.protocolo || sol?.protocolo || "—",
        oficina: o.oficinaNome?.trim() || "—",
        defeito: o.defeito?.trim() || "—",
        valor: Number(o.valorTotal) || 0,
        dataIso: timestampParaIso(o.criadoEm),
        status: o.status,
      };
    })
    .sort((a, b) => b.dataIso.localeCompare(a.dataIso));
}

export interface FiltrosAuditoriaDevolucao {
  dataInicio: string;
  dataFim: string;
  oficinaId: string;
  equipamento: string;
  statusOs: string;
}

export function filtrarLinhasAuditoria(
  linhas: LinhaAuditoriaDevolucao[],
  filtros: FiltrosAuditoriaDevolucao,
): LinhaAuditoriaDevolucao[] {
  return linhas.filter((r) => {
    if (filtros.dataInicio && r.dataIso && r.dataIso < filtros.dataInicio) {
      return false;
    }
    if (filtros.dataFim && r.dataIso && r.dataIso > filtros.dataFim) {
      return false;
    }
    if (
      filtros.equipamento &&
      filtros.equipamento !== "todos" &&
      r.equipamento !== filtros.equipamento
    ) {
      return false;
    }
    if (
      filtros.statusOs &&
      filtros.statusOs !== "todos" &&
      r.status !== filtros.statusOs
    ) {
      return false;
    }
    return true;
  });
}

export function filtrarPorOficina(
  linhas: LinhaAuditoriaDevolucao[],
  ordens: OrdemDevolucaoRaw[],
  oficinaId: string,
): LinhaAuditoriaDevolucao[] {
  if (!oficinaId || oficinaId === "todas") return linhas;
  const ids = new Set(
    ordens.filter((o) => o.oficinaId === oficinaId).map((o) => o.id),
  );
  return linhas.filter((r) => ids.has(r.osId));
}

export interface LinhaChdAuditoria {
  id: string;
  number: string;
  osProtocolo: string;
  solicitacaoOsId: string;
  equipamento: string;
  placa: string;
  oficinaId: string;
  oficinaNome: string;
  dataIso: string;
  horimetro: string;
  qtdPecas: number;
  qtdServicos: number;
  status: ChdStatusAuditoria;
}

export type ChdStatusAuditoria =
  | "enviado"
  | "em_conferencia"
  | "aceito"
  | "contestado";

const CHD_STATUS_LABEL: Record<string, string> = {
  enviado: "Enviado",
  em_conferencia: "Em conferência",
  aceito: "Aceito",
  contestado: "Contestado",
};

export function labelStatusChd(status: string): string {
  return CHD_STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

function isoFromCreatedAt(createdAt: string): string {
  if (!createdAt) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(createdAt);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function chdDocParaLinha(
  doc: {
    id: string;
    number: string;
    oficinaId: string;
    solicitacaoOsId?: string | null;
    identification?: {
      os?: string;
      date?: string;
      brandModel?: string;
      platePrefix?: string;
      hourMeter?: string;
    };
    parts?: { items?: unknown[] };
    services?: { items?: unknown[] };
    status: string;
    createdAt: string;
  },
  oficinasPorId: Map<string, string>,
): LinhaChdAuditoria {
  const id = doc.oficinaId?.trim() ?? "";
  const dataIdent = doc.identification?.date?.trim() ?? "";
  return {
    id: doc.id,
    number: doc.number?.trim() || doc.id,
    osProtocolo: doc.identification?.os?.trim() || "—",
    solicitacaoOsId: doc.solicitacaoOsId?.trim() ?? "",
    equipamento: doc.identification?.brandModel?.trim() || "—",
    placa: doc.identification?.platePrefix?.trim() || "—",
    oficinaId: id,
    oficinaNome: (id && oficinasPorId.get(id)) || id || "—",
    dataIso: dataIdent || isoFromCreatedAt(doc.createdAt),
    horimetro: doc.identification?.hourMeter?.trim() || "—",
    qtdPecas: doc.parts?.items?.length ?? 0,
    qtdServicos: doc.services?.items?.length ?? 0,
    status: (doc.status as ChdStatusAuditoria) || "enviado",
  };
}

export function filtrarLinhasChd(
  linhas: LinhaChdAuditoria[],
  filtros: FiltrosAuditoriaDevolucao,
): LinhaChdAuditoria[] {
  return linhas.filter((r) => {
    if (filtros.dataInicio && r.dataIso && r.dataIso < filtros.dataInicio) {
      return false;
    }
    if (filtros.dataFim && r.dataIso && r.dataIso > filtros.dataFim) {
      return false;
    }
    if (
      filtros.oficinaId &&
      filtros.oficinaId !== "todas" &&
      r.oficinaId !== filtros.oficinaId
    ) {
      return false;
    }
    if (
      filtros.equipamento &&
      filtros.equipamento !== "todos" &&
      r.equipamento !== filtros.equipamento
    ) {
      return false;
    }
    return true;
  });
}

export interface LinhaChdTela {
  dataLabel: string;
  statusLabel: string;
  equipamentoLabel: string;
}

export function linhaChdParaTela(linha: LinhaChdAuditoria): LinhaChdTela {
  const equipamentoLabel =
    linha.placa !== "—"
      ? `${linha.equipamento} · ${linha.placa}`
      : linha.equipamento;
  return {
    dataLabel: fmtDataBr(linha.dataIso),
    statusLabel: labelStatusChd(linha.status),
    equipamentoLabel,
  };
}

