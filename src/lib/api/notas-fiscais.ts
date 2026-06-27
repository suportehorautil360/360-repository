/**
 * Notas fiscais enviadas pelas oficinas — GET /notas-fiscais/prefeitura/:prefeituraId
 */
import { ApiError, api } from "./client";

export type NotaFiscalStatus = "pendente" | "aprovada" | "rejeitada";
export type NotaFiscalCategory = "servico" | "peca" | "combustivel" | "outros";

export interface NotaFiscalListItem {
  id: string;
  oficinaId: string;
  oficinaNome: string;
  prefeituraId?: string;
  solicitacaoOsId?: string;
  osProtocolo: string;
  osEquipamento: string;
  description: string;
  category: NotaFiscalCategory;
  documentType: "nfe-55" | "nfce-65";
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

export interface ListarNotasFiscaisFiltros {
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

export interface NotasFiscaisResumo {
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

interface RespListar {
  data: NotaFiscalListItem[];
  resumo: NotasFiscaisResumo;
  message: string;
}

const RESUMO_VAZIO: NotasFiscaisResumo = {
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

function queryListar(filtros?: ListarNotasFiscaisFiltros): string {
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
  async listarPorPrefeitura(
    prefeituraId: string,
    filtros?: ListarNotasFiscaisFiltros,
  ): Promise<RespListar> {
    const resp = await api.get<RespListar>(
      `/notas-fiscais/prefeitura/${encodeURIComponent(prefeituraId)}${queryListar(filtros)}`,
    );
    return {
      ...resp,
      resumo: resp.resumo ?? RESUMO_VAZIO,
    };
  },
};

export function labelStatusNotaFiscal(status: NotaFiscalStatus): string {
  if (status === "aprovada") return "Aprovada";
  if (status === "rejeitada") return "Rejeitada";
  return "Pendente";
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

/** NF com leitura incompleta do PDF (sem chave de 44 dígitos ou texto ilegível). */
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

export function labelNumeroNotaFiscal(row: {
  number?: string;
  parseCompleteness?: "completo" | "parcial";
  accessKey?: string;
  value?: number;
  issuerName?: string;
}): string {
  const n = row.number?.trim();
  if (n && n !== "0") return n;
  if (leituraPdfIncompleta(row)) return "Não identificado no PDF";
  return "Sem número";
}

export function labelEmitenteNotaFiscal(row: {
  issuerName?: string;
  description?: string;
  parseCompleteness?: "completo" | "parcial";
  accessKey?: string;
  number?: string;
  value?: number;
}): string {
  if (
    row.issuerName === "Aguardando leitura do PDF" ||
    (leituraPdfIncompleta(row) && !row.issuerName?.trim())
  ) {
    return "Dados não extraídos — abra o PDF";
  }
  return row.issuerName || row.description || "—";
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
