/**
 * Plano preventivo (matriz ciclos × linhas) — /planos-preventivos (back-360).
 */
import type { MatrizPreventiva } from "../../pages/prefeitura/sections/plano-preventivo-model";
import { ApiError, api } from "./client";

export interface PlanoPreventivoApi extends MatrizPreventiva {
  prefeituraId: string;
  atualizadoEm?: string;
}

interface RespPlano {
  data: PlanoPreventivoApi;
  message: string;
}

function toMatriz(data: PlanoPreventivoApi): MatrizPreventiva {
  return { ciclos: data.ciclos, linhas: data.linhas };
}

export const planosPreventivosApi = {
  /** Carrega matriz salva. null se 404 (usar seed local). */
  async obter(prefeituraId: string): Promise<MatrizPreventiva | null> {
    try {
      const r = await api.get<RespPlano>(
        `/planos-preventivos/${encodeURIComponent(prefeituraId)}`,
      );
      return toMatriz(r.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async salvar(
    prefeituraId: string,
    matriz: MatrizPreventiva,
  ): Promise<MatrizPreventiva> {
    const r = await api.put<RespPlano>(
      `/planos-preventivos/${encodeURIComponent(prefeituraId)}`,
      { ciclos: matriz.ciclos, linhas: matriz.linhas },
    );
    return toMatriz(r.data);
  },

  async restaurarPadrao(prefeituraId: string): Promise<MatrizPreventiva> {
    const r = await api.post<RespPlano>(
      `/planos-preventivos/${encodeURIComponent(prefeituraId)}/restaurar-padrao`,
    );
    return toMatriz(r.data);
  },
};
