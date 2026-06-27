/** Inbox de mensagens dos postos — endpoints /suporte/prefeitura do back. */
import { api } from "./client";

export type SuporteChannel = "financeiro" | "ti";
export type SuporteSender = "user" | "support";

export interface MensagemSuporte {
  id: string;
  postoId?: string;
  channel: SuporteChannel;
  sender: SuporteSender;
  text: string;
  createdAt: string;
  readAt?: string | null;
  adminReadAt?: string | null;
  autoReply?: boolean;
}

export interface SuporteThread {
  postoId: string;
  channel: SuporteChannel;
  lastMessage: string;
  lastMessageAt: string;
  lastSender: SuporteSender;
  unreadUserCount: number;
}

export const CANAL_LABEL: Record<SuporteChannel, string> = {
  financeiro: "Financeiro",
  ti: "TI / Suporte",
};

export const suporteApi = {
  async listarInbox(
    prefeituraId: string,
    channel?: SuporteChannel,
  ): Promise<SuporteThread[]> {
    const q = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    const r = await api.get<{ data: SuporteThread[] }>(
      `/suporte/prefeitura/${encodeURIComponent(prefeituraId)}/inbox${q}`,
    );
    return r.data ?? [];
  },

  async listarMensagens(
    prefeituraId: string,
    postoId: string,
    channel: SuporteChannel,
  ): Promise<MensagemSuporte[]> {
    const r = await api.get<{
      data: { channel: SuporteChannel; messages: MensagemSuporte[] };
    }>(
      `/suporte/prefeitura/${encodeURIComponent(prefeituraId)}/posto/${encodeURIComponent(postoId)}/mensagens?channel=${encodeURIComponent(channel)}`,
    );
    return r.data?.messages ?? [];
  },

  async responder(
    prefeituraId: string,
    postoId: string,
    channel: SuporteChannel,
    text: string,
  ): Promise<MensagemSuporte> {
    const r = await api.post<{ data: MensagemSuporte }>(
      `/suporte/prefeitura/${encodeURIComponent(prefeituraId)}/posto/${encodeURIComponent(postoId)}/responder`,
      { channel, text },
    );
    return r.data;
  },

  async marcarLidasAdmin(
    prefeituraId: string,
    postoId: string,
    channel: SuporteChannel,
  ): Promise<void> {
    await api.patch(
      `/suporte/prefeitura/${encodeURIComponent(prefeituraId)}/posto/${encodeURIComponent(postoId)}/admin-lidas`,
      { channel },
    );
  },

  /** Soma mensagens do operador ainda não lidas pelo gestor. */
  async contarPendentes(prefeituraId: string): Promise<number> {
    const threads = await suporteApi.listarInbox(prefeituraId);
    return threads.reduce((s, t) => s + t.unreadUserCount, 0);
  },
};
