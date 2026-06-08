/** Rede de parceiros (postos/oficinas) — GET /parceiros/overview (NestJS). */
import { api } from "./client";

export interface PostoParceiroApi {
  id: string;
  nome: string;
  cidadeUf: string;
  bandeira: string;
  ativo: boolean;
}

export interface OficinaParceiroApi {
  id: string;
  nome: string;
  cidadeUf: string;
  especialidade: string;
  ativo: boolean;
}

export interface ParceirosOverviewApi {
  postos: PostoParceiroApi[];
  oficinas: OficinaParceiroApi[];
}

export const parceirosApi = {
  async overview(): Promise<ParceirosOverviewApi> {
    const r = await api.get<{ data: ParceirosOverviewApi }>(
      "/parceiros/overview",
    );
    return r.data ?? { postos: [], oficinas: [] };
  },
};
