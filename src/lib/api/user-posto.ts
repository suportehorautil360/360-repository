/**
 * API de acesso do posto (boas-vindas por e-mail). Usa x-admin-secret como whatsapp.
 */
import { ApiError } from "./client";
import { adminSecretHeaders } from "./admin-secret";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "/api");

export interface BoasVindasPostoPayload {
  email: string;
  nome: string;
  usuario: string;
  postoNome?: string;
  senhaTemporaria?: string;
}

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
  return (await res.json()) as T;
}

export const userPostoApi = {
  /** Fire-and-forget: falha de e-mail não impede cadastro no Firestore. */
  async enviarBoasVindas(payload: BoasVindasPostoPayload): Promise<void> {
    try {
      await req<{ ok: boolean; message?: string }>(
        "POST",
        "/user/auth/boas-vindas-posto",
        payload,
      );
    } catch {
      /* best-effort */
    }
  },
};
