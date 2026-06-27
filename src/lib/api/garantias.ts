/**
 * Histórico de garantia por equipamento — GET /garantias/equipamento/:equipamentoId
 * (gerado no back quando a prefeitura aceita um CHD).
 */
import { api } from "./client";

export type GarantiaTipo = "peca" | "servico";
export type GarantiaStatus = "vigente" | "vencendo" | "vencido";

export interface GarantiaListItem {
  id: string;
  osOrigem: string;
  checklistDevolucaoId?: string;
  dataExec: string;
  tipo: GarantiaTipo;
  tipoLabel: string;
  item: string;
  fornecedor: string;
  prazo: string;
  limiteHorimetro: string;
  venceEm: string;
  status: GarantiaStatus;
}

export interface GarantiaResumoEquipamento {
  equipamentoId: string;
  equipamento: string;
  horimetroAtual: number | null;
  itensEmGarantia: number;
  prestesAVencer: number;
}

export interface ListarGarantiasEquipamentoFiltros {
  horimetroAtual?: string;
  status?: string;
  tipo?: string;
  busca?: string;
}

interface RespListar {
  resumo: GarantiaResumoEquipamento;
  data: GarantiaListItem[];
  message: string;
  chdsEncontrados?: number;
}

function queryListar(filtros?: ListarGarantiasEquipamentoFiltros): string {
  const params = new URLSearchParams();
  if (filtros?.horimetroAtual?.trim()) {
    params.set("horimetroAtual", filtros.horimetroAtual.trim());
  }
  if (filtros?.status && filtros.status !== "todos") {
    params.set("status", filtros.status);
  }
  if (filtros?.tipo && filtros.tipo !== "todos") {
    params.set("tipo", filtros.tipo);
  }
  if (filtros?.busca?.trim()) {
    params.set("busca", filtros.busca.trim());
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const garantiasApi = {
  async listarPorSolicitacao(
    solicitacaoOsId: string,
    filtros?: ListarGarantiasEquipamentoFiltros,
  ): Promise<RespListar> {
    return api.get<RespListar>(
      `/garantias/solicitacao/${encodeURIComponent(solicitacaoOsId)}${queryListar(filtros)}`,
    );
  },

  async listarPorEquipamento(
    equipamentoId: string,
    filtros?: ListarGarantiasEquipamentoFiltros,
  ): Promise<RespListar> {
    return api.get<RespListar>(
      `/garantias/equipamento/${encodeURIComponent(equipamentoId)}${queryListar(filtros)}`,
    );
  },
};

export function labelStatusGarantia(status: GarantiaStatus): string {
  if (status === "vigente") return "Vigente";
  if (status === "vencendo") return "Prestes a vencer";
  return "Vencido";
}
