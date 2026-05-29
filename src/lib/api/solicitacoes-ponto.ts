/**
 * API de solicitações de ajuste de ponto (módulo solicitacoes-ponto do
 * back-360-). Um único recurso atende incluir / cancelar / abono / mensagem.
 */
import { api } from "./client";

export const TIPOS_SOLICITACAO = [
  "incluir",
  "cancelar",
  "abono",
  "mensagem",
] as const;
export type TipoSolicitacao = (typeof TIPOS_SOLICITACAO)[number];

export type StatusSolicitacao = "pendente" | "aprovado" | "reprovado";

export interface SolicitacaoPonto {
  id: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  prefeituraId: string;
  name: string;
  cpf?: string | null;
  batidaId?: string | null;
  data?: string | null;
  timestampOriginal?: string | null;
  observacao?: string | null;
  anexoDataUrl?: string | null;
  anexoNome?: string | null;
  motivoReprovacao?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CriarSolicitacaoInput {
  tipo: TipoSolicitacao;
  prefeituraId: string;
  name: string;
  cpf?: string;
  batidaId?: string;
  data?: string;
  timestampOriginal?: string;
  observacao?: string;
  anexoDataUrl?: string;
  anexoNome?: string;
}

interface RespCriar {
  data: SolicitacaoPonto;
  message: string;
}
interface RespLista {
  data: SolicitacaoPonto[];
  message: string;
}
interface RespAvaliar {
  data: SolicitacaoPonto;
  message: string;
}

export const solicitacoesPontoApi = {
  async criar(input: CriarSolicitacaoInput): Promise<SolicitacaoPonto> {
    const r = await api.post<RespCriar>("/solicitacoes-ponto", input);
    return r.data;
  },

  async listar(prefeituraId: string): Promise<SolicitacaoPonto[]> {
    const r = await api.get<RespLista>(`/solicitacoes-ponto/${prefeituraId}`);
    return r.data;
  },

  async aprovar(id: string): Promise<void> {
    await api.post<RespAvaliar>(`/solicitacoes-ponto/${id}/aprovar`);
  },

  async reprovar(id: string, motivo: string): Promise<void> {
    await api.post<RespAvaliar>(`/solicitacoes-ponto/${id}/reprovar`, { motivo });
  },
};
