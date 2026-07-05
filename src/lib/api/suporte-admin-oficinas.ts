/**
 * Inbox de suporte das oficinas (postoapp) — endpoints admin /suporte/admin/oficina.
 * Requer header x-admin-secret (VITE_ADMIN_SECRET).
 */
import { ApiError } from "./client";
import { adminSecretHeaders } from "./admin-secret";
import type { MensagemSuporte, SuporteChannel } from "./suporte";
import { CANAL_LABEL } from "./suporte";

export type SuporteThreadOficina = {
  oficinaId: string;
  channel: SuporteChannel;
  lastMessage: string;
  lastMessageAt: string;
  lastSender: "user" | "support";
  unreadUserCount: number;
};

export type { MensagemSuporte, SuporteChannel };
export { CANAL_LABEL };

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "/api");

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: adminSecretHeaders(
      body != null ? { "Content-Type": "application/json" } : undefined,
    ),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) {
        message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
    } catch {
      /* sem corpo JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const suporteAdminOficinasApi = {
  async listarInbox(channel?: SuporteChannel): Promise<SuporteThreadOficina[]> {
    const q = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    const r = await req<{ data: SuporteThreadOficina[] }>(
      "GET",
      `/suporte/admin/oficina/inbox${q}`,
    );
    return r.data ?? [];
  },

  async listarMensagens(
    oficinaId: string,
    channel: SuporteChannel,
  ): Promise<MensagemSuporte[]> {
    const r = await req<{
      data: { channel: SuporteChannel; messages: MensagemSuporte[] };
    }>(
      "GET",
      `/suporte/admin/oficina/${encodeURIComponent(oficinaId)}/mensagens?channel=${encodeURIComponent(channel)}`,
    );
    return r.data?.messages ?? [];
  },

  async responder(
    oficinaId: string,
    channel: SuporteChannel,
    text: string,
  ): Promise<MensagemSuporte> {
    const r = await req<{ data: MensagemSuporte }>(
      "POST",
      `/suporte/admin/oficina/${encodeURIComponent(oficinaId)}/responder`,
      { channel, text },
    );
    return r.data;
  },

  async marcarLidasAdmin(
    oficinaId: string,
    channel: SuporteChannel,
  ): Promise<void> {
    await req(
      "PATCH",
      `/suporte/admin/oficina/${encodeURIComponent(oficinaId)}/admin-lidas`,
      { channel },
    );
  },

  async contarPendentes(): Promise<number> {
    const r = await req<{ data: { total: number } }>(
      "GET",
      "/suporte/admin/oficina/pendentes",
    );
    return r.data?.total ?? 0;
  },
};

export function notificarInboxSuporteOficinasAtualizado() {
  window.dispatchEvent(new CustomEvent("hu360:suporte-oficinas-atualizado"));
}
