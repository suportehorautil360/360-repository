/** Rede de parceiros (postos/oficinas) — /parceiros (NestJS). */
import { api } from "./client";

export type TipoParceiroApi = "posto" | "oficina";

export interface PostoParceiroApi {
  id: string;
  nome: string;
  razaoSocial: string;
  cidadeUf: string;
  bandeira: string;
  condicaoPagamento: string;
  limiteCredito: number;
  ativo: boolean;
}

export interface OficinaParceiroApi {
  id: string;
  nome: string;
  razaoSocial: string;
  cidadeUf: string;
  especialidade: string;
  condicaoPagamento: string;
  limiteCredito: number;
  ativo: boolean;
}

export interface ParceirosOverviewApi {
  postos: PostoParceiroApi[];
  oficinas: OficinaParceiroApi[];
}

export interface CriarParceiroPayload {
  tipo: TipoParceiroApi;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj?: string;
  telefonePrincipal?: string;
  emailComercial?: string;
  cidadeUf?: string;
  endereco?: string;
  // posto
  bandeira?: string;
  combustiveis?: string[];
  servicos?: string[];
  // oficina
  linhasAtuacao?: string[];
  categoriasServico?: string[];
  especificacoes?: string;
  // financeiro
  condicaoPagamento?: string;
  limiteCredito?: number;
  descontoComercial?: string;
  observacoesFaturamento?: string;
}

export const parceirosApi = {
  async overview(): Promise<ParceirosOverviewApi> {
    const r = await api.get<{ data: ParceirosOverviewApi }>(
      "/parceiros/overview",
    );
    return r.data ?? { postos: [], oficinas: [] };
  },

  async criar(
    payload: CriarParceiroPayload,
  ): Promise<{ id: string; tipo: TipoParceiroApi }> {
    const r = await api.post<{
      data: { id: string; tipo: TipoParceiroApi };
      message: string;
    }>("/parceiros", payload);
    return r.data;
  },

  async remover(tipo: TipoParceiroApi, id: string): Promise<void> {
    await api.del(`/parceiros/${tipo}/${id}`);
  },
};
