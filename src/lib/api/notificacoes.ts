/**
 * API de notificações (módulo notificacoes do back-360-).
 * Destinatário polimórfico:
 *  - tipo "funcionario": id é o CPF (limpo) do operador
 *  - tipo "rh": id é o prefeituraId (broadcast)
 */
import { api } from "./client";

export type DestinatarioTipo = "funcionario" | "rh";
export type NotificacaoTipo = "info" | "sucesso" | "aviso" | "erro";

export interface Notificacao {
  id: string;
  destinatarioTipo: DestinatarioTipo;
  destinatarioId: string;
  prefeituraId: string;
  titulo: string;
  mensagem: string;
  tipo: NotificacaoTipo;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  lida: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RespLista {
  data: Notificacao[];
  message: string;
}

export const notificacoesApi = {
  async listar(
    destinatarioTipo: DestinatarioTipo,
    destinatarioId: string,
  ): Promise<Notificacao[]> {
    const r = await api.get<RespLista>(
      `/notificacoes/${destinatarioTipo}/${destinatarioId}`,
    );
    return r.data;
  },

  async marcarLida(id: string): Promise<void> {
    await api.post(`/notificacoes/${id}/lida`);
  },

  async marcarTodasLidas(
    destinatarioTipo: DestinatarioTipo,
    destinatarioId: string,
  ): Promise<void> {
    await api.post(
      `/notificacoes/marcar-todas/${destinatarioTipo}/${destinatarioId}`,
    );
  },
};
