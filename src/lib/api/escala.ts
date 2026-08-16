/** API da escala (jornada). Detecta sessão Supabase automaticamente:
 *  - PWA operador (com JWT) → Supabase direto (RLS filtra empresa)
 *  - Portal admin/RH (sem sessão Supabase) → NestJS legado */
import { api } from "./client";
import { getCurrentCompanyId } from "../supabase/session";
import { obterEscalaSupabase } from "../supabase/pwa-reads";

export interface Escala {
  prefeituraId: string;
  /** Início da jornada "HH:MM". */
  inicio: string;
  /** Fim da jornada "HH:MM". */
  fim: string;
  /** Dias trabalhados (0=domingo … 6=sábado). */
  diasSemana: number[];
  /** Duração do almoço em minutos. */
  almocoMinutos: number;
}

export const escalaApi = {
  async obter(prefeituraId: string): Promise<Escala | null> {
    if (await getCurrentCompanyId()) return obterEscalaSupabase(prefeituraId);
    const r = await api.get<{ data: Escala | null }>(`/escala/${prefeituraId}`);
    return r.data;
  },

  async salvar(escala: Escala): Promise<void> {
    await api.post("/escala", escala);
  },
};
