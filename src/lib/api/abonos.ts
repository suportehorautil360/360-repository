/**
 * API de abonos (módulo `abonos` do back-360-). Criado automaticamente
 * quando o RH aprova uma solicitação tipo='abono'. O front consulta para
 * classificar o dia como `abonado` em vez de `falta` no cálculo de saldo
 * e KPIs.
 */
import { api } from "./client";

export interface Abono {
  id: string;
  prefeituraId: string;
  /** CPF do funcionário, só dígitos. */
  funcionarioCpf: string;
  funcionarioNome: string;
  /** Data abonada no formato YYYY-MM-DD (local). */
  data: string;
  motivo?: string | null;
  solicitacaoId?: string | null;
  createdAt: string;
}

interface RespLista {
  data: Abono[];
  message: string;
}

export const abonosApi = {
  async listar(prefeituraId: string): Promise<Abono[]> {
    const r = await api.get<RespLista>(`/abonos/${prefeituraId}`);
    return r.data;
  },

  async remover(id: string): Promise<void> {
    await api.del(`/abonos/${id}`);
  },
};
