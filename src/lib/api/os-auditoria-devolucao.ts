/**
 * Auditoria de Devolução — preview via GET /os/solicitacoes (Fase 4 completa virá em
 * GET /os/auditoria-devolucao). Valor e oficina executora dependem da API de orçamentos.
 */
import type {
  LinhaAuditoriaDevolucao,
} from "../../pages/prefeitura/sections/auditoria-devolucao-model";
import type { SolicitacaoOsApi } from "./os-solicitacoes";
import { ApiError, api } from "./client";

export interface FiltrosAuditoriaApi {
  status?: string;
  startDate?: string;
  endDate?: string;
  oficinaId?: string;
  equipamento?: string;
}

interface RespListar {
  data: SolicitacaoOsApi[];
  message: string;
}

function parseDataIso(item: SolicitacaoOsApi): string {
  if (item.criadoEm?.seconds) {
    const d = new Date(item.criadoEm.seconds * 1000);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  if (item.createdAt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.createdAt);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return "";
}

function fmtLinha(linha: string | undefined): string {
  const t = linha?.trim();
  if (!t) return "—";
  if (/^linha\s/i.test(t)) return t;
  return `Linha ${t}`;
}

export function solicitacaoParaLinhaAuditoria(
  item: SolicitacaoOsApi,
): LinhaAuditoriaDevolucao {
  const oficinas = item.oficinas ?? item.workshops ?? [];
  return {
    osId: item.id,
    equipamento: item.equipamento ?? item.equipment ?? "—",
    classificacao: fmtLinha(item.linha ?? item.line),
    protocolo: item.protocolo ?? item.protocol ?? "—",
    oficina: oficinas.filter(Boolean).join(", ") || "—",
    defeito: item.relato ?? item.report ?? "—",
    valor: 0,
    dataIso: parseDataIso(item),
    status: item.status,
  };
}

function queryListar(filtros?: FiltrosAuditoriaApi): string {
  const params = new URLSearchParams();
  if (filtros?.status && filtros.status !== "todos") {
    params.set("status", filtros.status);
  }
  if (filtros?.startDate) params.set("startDate", filtros.startDate);
  if (filtros?.endDate) params.set("endDate", filtros.endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function passaFiltroOficina(
  item: SolicitacaoOsApi,
  oficinaId?: string,
): boolean {
  if (!oficinaId || oficinaId === "todas") return true;
  const ids = item.oficinasIds ?? item.workshopIds ?? [];
  return ids.includes(oficinaId);
}

function passaFiltroEquipamento(
  item: SolicitacaoOsApi,
  equipamento?: string,
): boolean {
  if (!equipamento || equipamento === "todos") return true;
  const eq = (item.equipamento ?? item.equipment ?? "").trim();
  return eq === equipamento;
}

export function mensagemErroAuditoriaDevolucao(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) {
    return "Município não encontrado.";
  }
  return "Não foi possível carregar os dados de devolução.";
}

export const osAuditoriaDevolucaoApi = {
  async listarSolicitacoes(
    prefeituraId: string,
    filtros?: FiltrosAuditoriaApi,
  ): Promise<SolicitacaoOsApi[]> {
    const r = await api.get<RespListar>(
      `/os/solicitacoes/${encodeURIComponent(prefeituraId)}${queryListar(filtros)}`,
    );
    return r.data ?? [];
  },

  async listarLinhas(
    prefeituraId: string,
    filtros: FiltrosAuditoriaApi,
  ): Promise<LinhaAuditoriaDevolucao[]> {
    const { oficinaId, equipamento, ...apiFiltros } = filtros;
    const items = await this.listarSolicitacoes(prefeituraId, apiFiltros);
    return items
      .filter(
        (item) =>
          passaFiltroOficina(item, oficinaId) &&
          passaFiltroEquipamento(item, equipamento),
      )
      .map(solicitacaoParaLinhaAuditoria)
      .sort((a, b) => b.dataIso.localeCompare(a.dataIso));
  },

  /** Nomes distintos de equipamento (para o select). */
  async listarEquipamentos(prefeituraId: string): Promise<string[]> {
    const items = await this.listarSolicitacoes(prefeituraId);
    const set = new Set<string>();
    for (const item of items) {
      const eq = (item.equipamento ?? item.equipment ?? "").trim();
      if (eq) set.add(eq);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  },
};
