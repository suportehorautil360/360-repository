/**
 * Insumos da O.S. — GET /insumos/solicitacao/:solicitacaoOsId
 * (peças e materiais do orçamento).
 */
import { api } from "./client";

export interface InsumoListItem {
  id: string;
  /** Código da peça — vem do campo `code` do item de orçamento na API. */
  codigo: string;
  /** Alias EN do mesmo valor (`code` na API de orçamento). */
  code: string;
  descricao: string;
  marca: string | null;
  qtd: number;
  unid: string;
  vlrUnit: number;
  total: number;
}

export interface InsumoResumoOs {
  totalItens: number;
  valorTotal: number;
  orcamentosEncontrados: number;
}

interface RespListar {
  resumo: InsumoResumoOs;
  data: InsumoListItem[];
  message: string;
}

export const insumosApi = {
  async listarPorSolicitacao(
    solicitacaoOsId: string,
  ): Promise<RespListar> {
    return api.get<RespListar>(
      `/insumos/solicitacao/${encodeURIComponent(solicitacaoOsId)}`,
    );
  },
};
