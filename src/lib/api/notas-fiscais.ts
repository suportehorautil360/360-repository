/**
 * API de notas fiscais — combustível (postos) e oficinas (O.S.).
 */
import { ApiError, api } from "./client";

export type NotaFiscalStatus = "pendente" | "aprovada" | "rejeitada";
export type NotaFiscalCategory = "servico" | "peca" | "combustivel" | "outros";
export type NotaDocumentType = "nfe-55" | "nfce-65";

/** NF de combustível enviada por posto. */
export interface NotaFiscalCombustivel {
  id: string;
  postoId?: string;
  prefeituraId?: string;
  description: string;
  category: NotaFiscalCategory;
  documentType: NotaDocumentType;
  number: string;
  issuerName: string;
  issuedAt: string;
  accessKey: string;
  value: number;
  status: NotaFiscalStatus;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  parseCompleteness?: "completo" | "parcial";
}

/** NF enviada por oficina, enriquecida com O.S. */
export interface NotaFiscalOficinaListItem {
  id: string;
  oficinaId: string;
  oficinaNome: string;
  prefeituraId?: string;
  solicitacaoOsId?: string;
  osProtocolo: string;
  osEquipamento: string;
  description: string;
  category: NotaFiscalCategory;
  documentType: NotaDocumentType;
  number: string;
  issuerName: string;
  issuedAt: string;
  accessKey: string;
  value: number;
  status: NotaFiscalStatus;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  parseCompleteness?: "completo" | "parcial";
}

export interface ListarNotasFiscaisOficinasFiltros {
  busca?: string;
  oficinaId?: string;
  status?: NotaFiscalStatus | "todos";
  startDate?: string;
  endDate?: string;
}

export interface NotaFiscalResumoGrafico {
  label: string;
  valor: number;
  quantidade?: number;
}

export interface NotasFiscaisOficinasResumo {
  totalNotas: number;
  valorTotal: number;
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
  oficinas: number;
  porMes: NotaFiscalResumoGrafico[];
  porStatus: NotaFiscalResumoGrafico[];
  porOficina: NotaFiscalResumoGrafico[];
}

const RESUMO_OFICINAS_VAZIO: NotasFiscaisOficinasResumo = {
  totalNotas: 0,
  valorTotal: 0,
  pendentes: 0,
  aprovadas: 0,
  rejeitadas: 0,
  oficinas: 0,
  porMes: [],
  porStatus: [],
  porOficina: [],
};

export const STATUS_LABEL: Record<NotaFiscalStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

function queryOficinas(filtros?: ListarNotasFiscaisOficinasFiltros): string {
  const params = new URLSearchParams();
  if (filtros?.busca?.trim()) params.set("busca", filtros.busca.trim());
  if (filtros?.oficinaId?.trim()) params.set("oficinaId", filtros.oficinaId.trim());
  if (filtros?.status && filtros.status !== "todos") {
    params.set("status", filtros.status);
  }
  if (filtros?.startDate?.trim()) params.set("startDate", filtros.startDate.trim());
  if (filtros?.endDate?.trim()) params.set("endDate", filtros.endDate.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const notasFiscaisApi = {
  /** NF de combustível dos postos. */
  async listarCombustivel(prefeituraId: string): Promise<NotaFiscalCombustivel[]> {
    const r = await api.get<{ data: NotaFiscalCombustivel[] }>(
      `/notas-fiscais/prefeitura/${encodeURIComponent(prefeituraId)}/combustivel`,
    );
    return r.data ?? [];
  },

  /** NF das oficinas (O.S.) com resumo agregado. */
  async listarOficinasPorPrefeitura(
    prefeituraId: string,
    filtros?: ListarNotasFiscaisOficinasFiltros,
  ): Promise<{
    data: NotaFiscalOficinaListItem[];
    resumo: NotasFiscaisOficinasResumo;
    message: string;
  }> {
    const resp = await api.get<{
      data: NotaFiscalOficinaListItem[];
      resumo: NotasFiscaisOficinasResumo;
      message: string;
    }>(
      `/notas-fiscais/prefeitura/${encodeURIComponent(prefeituraId)}/oficinas${queryOficinas(filtros)}`,
    );
    return {
      ...resp,
      resumo: resp.resumo ?? RESUMO_OFICINAS_VAZIO,
    };
  },

  async atualizarStatus(id: string, status: NotaFiscalStatus): Promise<void> {
    await api.patch(`/notas-fiscais/${encodeURIComponent(id)}/status`, {
      status,
    });
  },
};

export function documentoLabel(t: NotaDocumentType): string {
  return t === "nfce-65" ? "NFC-e" : "NF-e";
}

export function labelStatusNotaFiscal(status: NotaFiscalStatus): string {
  return STATUS_LABEL[status];
}

export function mensagemErroListarNotasFiscais(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Não foi possível carregar as notas fiscais.";
}

export function fmtValorNotaFiscal(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function leituraPdfIncompleta(row: {
  parseCompleteness?: "completo" | "parcial";
  accessKey?: string;
  number?: string;
  value?: number;
  issuerName?: string;
}): boolean {
  if (row.parseCompleteness === "completo") return false;
  if (row.parseCompleteness === "parcial") return true;
  const semChave = !row.accessKey?.replace(/\D/g, "").length;
  const defaults =
    (row.number === "0" || !row.number) &&
    (row.value === 0 || row.value == null) &&
    row.issuerName === "Aguardando leitura do PDF";
  return semChave || defaults;
}

export function fmtValorNotaFiscalRow(row: {
  value: number;
  parseCompleteness?: "completo" | "parcial";
  accessKey?: string;
  number?: string;
  issuerName?: string;
}): string {
  if (leituraPdfIncompleta(row) && (row.value === 0 || row.value == null)) {
    return "Ver PDF";
  }
  return fmtValorNotaFiscal(row.value);
}

export function fmtDataNotaFiscal(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export function fmtPeriodoNotasFiscais(inicio: string, fim: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return d && m && y ? `${d}/${m}/${y}` : iso;
  };
  return `${fmt(inicio)} — ${fmt(fim)}`;
}
