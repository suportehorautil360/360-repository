/**
 * Orçamentos e Aprovações — GET /os/solicitacoes/:id/com-orcamentos;
 * aprovação via PATCH /os/solicitacoes/:id/aprovar.
 */
import type {
  ItemOrdemOrcamento,
  OrdemOrcamento,
  SolicitacaoOrcamento,
} from "../../pages/prefeitura/sections/orcamentos-aprovacoes-model";
import type { SolicitacaoOsApi } from "./os-solicitacoes";
import { ApiError, api } from "./client";

interface QuoteItemApi {
  description?: string;
  descricao?: string;
  value?: number;
  valor?: number;
  category?: "part" | "service" | "travel";
  code?: string;
  codigo?: string;
  brand?: string;
  marca?: string;
  quantity?: number;
  quantidade?: number;
  unitValue?: number;
  valorUnitario?: number;
  hourType?: string;
  tipoHora?: string;
  hours?: number;
  horas?: number;
  hourlyRate?: number;
  valorHora?: number;
  km?: number;
  valuePerKm?: number;
  valorPorKm?: number;
  travelHours?: number;
  horasViagem?: number;
  travelHourlyRate?: number;
  valorHoraViagem?: number;
  fees?: number;
  taxas?: number;
}

interface QuoteApi {
  id: string;
  protocol?: string;
  protocolo?: string;
  solicitacaoOsId?: string;
  workshopName?: string;
  oficinaNome?: string;
  operator?: string;
  operador?: string;
  equipment?: string;
  equipamento?: string;
  defect?: string;
  defeito?: string;
  items?: QuoteItemApi[];
  itens?: QuoteItemApi[];
  totalValue?: number;
  valorTotal?: number;
  status: string;
  prazoDias?: number;
  createdAt?: string;
  criadoEm?: { seconds: number } | null;
}

interface SolicitacaoComOrcamentosApi extends SolicitacaoOsApi {
  invitedCount?: number;
  quotesReceived?: number;
  quotes?: QuoteApi[];
  orcamentos?: QuoteApi[];
}

interface RespListarComOrcamentos {
  data: SolicitacaoComOrcamentosApi[];
  message: string;
}

export interface OsComOrcamentosCard {
  solicitacao: SolicitacaoOrcamento;
  ordens: OrdemOrcamento[];
}

function parseCriadoEm(item: {
  createdAt?: string;
  criadoEm?: { seconds: number } | null;
}): { seconds: number } | null {
  if (item.criadoEm?.seconds) return item.criadoEm;
  if (!item.createdAt) return null;
  const ms = new Date(item.createdAt).getTime();
  if (Number.isNaN(ms)) return null;
  return { seconds: Math.floor(ms / 1000) };
}

function solicitacaoApiParaOrcamento(
  item: SolicitacaoComOrcamentosApi,
): SolicitacaoOrcamento {
  const oficinasIds = item.oficinasIds ?? item.workshopIds;
  const convidadas =
    item.invitedCount ??
    oficinasIds?.length ??
    item.oficinas?.length ??
    item.workshops?.length;

  return {
    id: item.id,
    protocolo: item.protocolo ?? item.protocol ?? "",
    equipamento: item.equipamento ?? item.equipment ?? "",
    linha: item.linha ?? item.line ?? "",
    operador: item.operador ?? item.operator ?? "",
    relato: item.relato ?? item.report ?? "",
    oficinas: item.oficinas ?? item.workshops,
    oficinasIds,
    convidadas,
    status: item.status,
    criadoEm: parseCriadoEm(item),
  };
}

export function quoteApiParaOrdem(
  q: QuoteApi,
  solicitacaoId: string,
): OrdemOrcamento {
  const itensRaw = q.itens ?? q.items ?? [];
  const itens = itensRaw.map(
    (it): ItemOrdemOrcamento => ({
      descricao: it.descricao ?? it.description ?? "",
      valor: it.valor ?? it.value ?? 0,
      category: it.category,
      codigo: it.codigo ?? it.code,
      marca: it.marca ?? it.brand,
      quantidade: it.quantidade ?? it.quantity,
      valorUnitario: it.valorUnitario ?? it.unitValue,
      tipoHora: it.tipoHora ?? it.hourType,
      horas: it.horas ?? it.hours,
      valorHora: it.valorHora ?? it.hourlyRate,
      km: it.km,
      valorPorKm: it.valorPorKm ?? it.valuePerKm,
      horasViagem: it.horasViagem ?? it.travelHours,
      valorHoraViagem: it.valorHoraViagem ?? it.travelHourlyRate,
      taxas: it.taxas ?? it.fees,
    }),
  );
  const valorTotal =
    q.valorTotal ??
    q.totalValue ??
    itens.reduce((s, i) => s + (i.valor || 0), 0);

  return {
    id: q.id,
    protocolo: q.protocolo ?? q.protocol ?? "",
    solicitacaoOsId: q.solicitacaoOsId ?? solicitacaoId,
    operador: q.operador ?? q.operator ?? q.oficinaNome ?? q.workshopName ?? "",
    oficinaNome: q.oficinaNome ?? q.workshopName,
    equipamento: q.equipamento ?? q.equipment ?? "",
    defeito: q.defeito ?? q.defect ?? "",
    itens,
    valorTotal,
    prazoDias: q.prazoDias,
    status: q.status,
    criadoEm: parseCriadoEm(q),
  };
}

export function mensagemErroAprovarOrcamento(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return "Solicitação ou orçamento não encontrado.";
    }
    if (err.status === 409) {
      return "Esta O.S. já foi aprovada.";
    }
    if (err.status === 422) {
      return err.message || "Não é possível aprovar este orçamento.";
    }
  }
  return "Erro ao aprovar. Tente novamente.";
}

export function mensagemErroListarOrcamentos(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) {
    return "Município não encontrado.";
  }
  return "Não foi possível carregar orçamentos.";
}

export const osOrcamentosAprovacoesApi = {
  /** Lista O.S. do município com orçamentos (ordensServico) aninhados. */
  async listarCards(prefeituraId: string): Promise<OsComOrcamentosCard[]> {
    const r = await api.get<RespListarComOrcamentos>(
      `/os/solicitacoes/${encodeURIComponent(prefeituraId)}/com-orcamentos`,
    );

    return (r.data ?? []).map((item) => {
      const quotes = item.quotes ?? item.orcamentos ?? [];
      return {
        solicitacao: solicitacaoApiParaOrcamento(item),
        ordens: quotes.map((q) => quoteApiParaOrdem(q, item.id)),
      };
    });
  },

  async listarOrcamentos(prefeituraId: string): Promise<OrdemOrcamento[]> {
    const cards = await this.listarCards(prefeituraId);
    return cards.flatMap((c) => c.ordens);
  },

  async aprovar(solicitacaoId: string, ordemServicoId: string): Promise<void> {
    await api.patch(
      `/os/solicitacoes/${encodeURIComponent(solicitacaoId)}/aprovar`,
      { ordemServicoId },
    );
  },
};
