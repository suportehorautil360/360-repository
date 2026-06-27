/**
 * Inbox de suporte dos postos — endpoints admin /suporte/admin do back.
 * Requer header x-admin-secret (VITE_ADMIN_SECRET).
 */
import { ApiError } from "./client";
import { adminSecretHeaders } from "./admin-secret";
import type {
  MensagemSuporte,
  SuporteChannel,
  SuporteThread,
} from "./suporte";

export type { MensagemSuporte, SuporteChannel, SuporteThread };
export { CANAL_LABEL } from "./suporte";

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

export const suporteAdminApi = {
  async listarInbox(channel?: SuporteChannel): Promise<SuporteThread[]> {
    const q = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    const r = await req<{ data: SuporteThread[] }>("GET", `/suporte/admin/inbox${q}`);
    return r.data ?? [];
  },

  async listarMensagens(
    postoId: string,
    channel: SuporteChannel,
  ): Promise<MensagemSuporte[]> {
    const r = await req<{
      data: { channel: SuporteChannel; messages: MensagemSuporte[] };
    }>(
      "GET",
      `/suporte/admin/posto/${encodeURIComponent(postoId)}/mensagens?channel=${encodeURIComponent(channel)}`,
    );
    return r.data?.messages ?? [];
  },

  async responder(
    postoId: string,
    channel: SuporteChannel,
    text: string,
  ): Promise<MensagemSuporte> {
    const r = await req<{ data: MensagemSuporte }>(
      "POST",
      `/suporte/admin/posto/${encodeURIComponent(postoId)}/responder`,
      { channel, text },
    );
    return r.data;
  },

  async marcarLidasAdmin(postoId: string, channel: SuporteChannel): Promise<void> {
    await req(
      "PATCH",
      `/suporte/admin/posto/${encodeURIComponent(postoId)}/admin-lidas`,
      { channel },
    );
  },

  async contarPendentes(): Promise<number> {
    const r = await req<{ data: { total: number } }>("GET", "/suporte/admin/pendentes");
    return r.data?.total ?? 0;
  },
};

/** Dispara após ler/responder no inbox admin. */
export function notificarInboxSuporteAdminAtualizado() {
  window.dispatchEvent(new CustomEvent("hu360:suporte-admin-atualizado"));
}
