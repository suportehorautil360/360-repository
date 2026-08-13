/**
 * Plano preventivo — categorias com matriz própria — /planos-preventivos
 */
import {
  normalizarPlano,
  type PlanoPreventivo,
} from "../../pages/prefeitura/sections/plano-preventivo-model";
import { ApiError, api } from "./client";

export interface PlanoPreventivoApi extends PlanoPreventivo {
  prefeituraId: string;
  atualizadoEm?: string;
}

interface RespPlano {
  data: PlanoPreventivoApi;
  message: string;
}

function toPlano(data: PlanoPreventivoApi): PlanoPreventivo {
  return normalizarPlano(data);
}

export const planosPreventivosApi = {
  /** Carrega plano. null se 404 (usar seed local). */
  async obter(prefeituraId: string): Promise<PlanoPreventivo | null> {
    try {
      const r = await api.get<RespPlano>(
        `/planos-preventivos/${encodeURIComponent(prefeituraId)}`,
      );
      return toPlano(r.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async salvar(
    prefeituraId: string,
    plano: PlanoPreventivo,
  ): Promise<PlanoPreventivo> {
    const payload = normalizarPlano(plano);
    const r = await api.put<RespPlano>(
      `/planos-preventivos/${encodeURIComponent(prefeituraId)}`,
      { categorias: payload.categorias },
    );
    return toPlano(r.data);
  },

  async restaurarPadrao(prefeituraId: string): Promise<PlanoPreventivo> {
    const r = await api.post<RespPlano>(
      `/planos-preventivos/${encodeURIComponent(prefeituraId)}/restaurar-padrao`,
    );
    return toPlano(r.data);
  },
};
