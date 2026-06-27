/**
 * Histórico de ocorrências — GET /ocorrencias/solicitacao/:solicitacaoOsId
 */
import { api } from "./client";

export interface OcorrenciaListItem {
  id: string;
  dataHora: string;
  usuario: string;
  mensagem: string;
  tipo: string;
}

export interface OcorrenciaResumoOs {
  total: number;
}

interface RespListar {
  resumo: OcorrenciaResumoOs;
  data: OcorrenciaListItem[];
  message: string;
}

export const ocorrenciasApi = {
  async listarPorSolicitacao(
    solicitacaoOsId: string,
  ): Promise<RespListar> {
    return api.get<RespListar>(
      `/ocorrencias/solicitacao/${encodeURIComponent(solicitacaoOsId)}`,
    );
  },
};
