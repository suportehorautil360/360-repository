/** Rede de parceiros (postos/oficinas) — /parceiros (NestJS). */
import { api } from "./client";

export type TipoParceiroApi = "posto" | "oficina";

export interface PostoParceiroApi {
  id: string;
  prefeituraId: string;
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
  prefeituraId: string;
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

export interface ParceiroDetalheApi {
  id: string;
  tipo: TipoParceiroApi;
  prefeituraId: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefonePrincipal: string;
  emailComercial: string;
  cidadeUf: string;
  endereco: string;
  bandeira: string;
  combustiveis: string[];
  servicos: string[];
  linhasAtuacao: string[];
  segmentosAtuacao: string[];
  categoriasServico: string[];
  especificacoes: string;
  condicaoPagamento: string;
  limiteCredito: number;
  descontoComercial: string;
  observacoesFaturamento: string;
  status: string;
  ativo: boolean;
}

export type AtualizarParceiroPayload = Omit<
  CriarParceiroPayload,
  "tipo" | "prefeituraId"
>;

export interface CriarParceiroPayload {
  tipo: TipoParceiroApi;
  /** Cliente/município vinculado — enviado como prefeituraId ao backend. */
  prefeituraId?: string;
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
  segmentosAtuacao?: string[];
  categoriasServico?: string[];
  especificacoes?: string;
  // financeiro
  condicaoPagamento?: string;
  limiteCredito?: number;
  descontoComercial?: string;
  observacoesFaturamento?: string;
}

export interface ParceiroLoginApi {
  id: string;
  nome: string;
  usuario: string;
  perfil: string;
  vinculo: TipoParceiroApi;
  prefeituraId: string;
  postoId?: string;
  officinaId?: string;
  createdAt: string;
}

export interface CriarParceiroLoginGeradoApi {
  nome: string;
  usuario: string;
  senhaInicial: string;
}

export interface CriarParceiroLoginPayload {
  nome: string;
  usuario: string;
  senha: string;
  perfil?: "gestor" | "admin";
}

export const parceirosApi = {
  async overview(prefeituraId?: string): Promise<ParceirosOverviewApi> {
    const qs = prefeituraId?.trim()
      ? `?prefeituraId=${encodeURIComponent(prefeituraId.trim())}`
      : "";
    const r = await api.get<{ data: ParceirosOverviewApi }>(
      `/parceiros/overview${qs}`,
    );
    return r.data ?? { postos: [], oficinas: [] };
  },

  async criar(
    payload: CriarParceiroPayload,
  ): Promise<{
    id: string;
    tipo: TipoParceiroApi;
    login?: CriarParceiroLoginGeradoApi;
  }> {
    const r = await api.post<{
      data: {
        id: string;
        tipo: TipoParceiroApi;
        login?: CriarParceiroLoginGeradoApi;
      };
      message: string;
    }>("/parceiros", payload);
    return r.data;
  },

  async obter(
    tipo: TipoParceiroApi,
    id: string,
  ): Promise<ParceiroDetalheApi> {
    const r = await api.get<{ data: ParceiroDetalheApi }>(
      `/parceiros/${tipo}/${encodeURIComponent(id)}`,
    );
    return r.data;
  },

  async atualizar(
    tipo: TipoParceiroApi,
    id: string,
    payload: AtualizarParceiroPayload,
  ): Promise<void> {
    await api.patch(
      `/parceiros/${tipo}/${encodeURIComponent(id)}`,
      payload,
    );
  },

  async remover(tipo: TipoParceiroApi, id: string): Promise<void> {
    await api.del(`/parceiros/${tipo}/${id}`);
  },

  async listarLogins(
    tipo: TipoParceiroApi,
    parceiroId: string,
  ): Promise<ParceiroLoginApi[]> {
    const r = await api.get<{ data: ParceiroLoginApi[] }>(
      `/parceiros/${tipo}/${encodeURIComponent(parceiroId)}/logins`,
    );
    return r.data ?? [];
  },

  async criarLogin(
    tipo: TipoParceiroApi,
    parceiroId: string,
    payload: CriarParceiroLoginPayload,
  ): Promise<ParceiroLoginApi> {
    const r = await api.post<{ data: ParceiroLoginApi; message: string }>(
      `/parceiros/${tipo}/${encodeURIComponent(parceiroId)}/logins`,
      payload,
    );
    return r.data;
  },

  async resetarLoginSenha(acessoId: string, senha: string): Promise<void> {
    await api.patch(
      `/parceiros/logins/${encodeURIComponent(acessoId)}/senha`,
      { senha },
    );
  },

  async removerLogin(acessoId: string): Promise<void> {
    await api.del(`/parceiros/logins/${encodeURIComponent(acessoId)}`);
  },
};
