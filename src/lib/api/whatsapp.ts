/**
 * API da integração WhatsApp (rotas admin do back-360-). Envia o segredo admin
 * (`VITE_ADMIN_SECRET`) no header `x-admin-secret`.
 */
import { ApiError } from "./client";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "/api");

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET as string | undefined;

export type WhatsAppStatus =
  | "desconectado"
  | "conectando"
  | "aguardando_qr"
  | "conectado";

export interface WhatsAppStatusResp {
  status: WhatsAppStatus;
  /** Imagem (dataURL) do QR quando `aguardando_qr`. */
  qrImagem?: string;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/whatsapp${path}`, {
    method,
    headers: {
      ...(body != null ? { "Content-Type": "application/json" } : {}),
      ...(ADMIN_SECRET ? { "x-admin-secret": ADMIN_SECRET } : {}),
    },
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
  const json = (await res.json()) as { data: T };
  return json.data;
}

export const whatsappApi = {
  status: () => req<WhatsAppStatusResp>("GET", "/status"),
  conectar: () => req<WhatsAppStatusResp>("POST", "/connect"),
  desconectar: () => req<unknown>("POST", "/logout"),
  enviarTeste: (numero: string) =>
    req<unknown>("POST", "/enviar-teste", { numero }),
};
