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

export interface WhatsappSessao {
  numeroConectado: string | null;
  nomeSessao: string | null;
  conectadoDesde: string | null;
  ultimaAtividade: string | null;
  versaoSessao: string | null;
  ambiente: "dev" | "prod";
}
export interface WhatsappDisponibilidade {
  percentual: number;
  desde: string;
  janelaCompleta: boolean;
}
export interface WhatsappKpis {
  empresasUtilizando: number;
  mensagensHoje: number;
  mensagens30d: number;
  disponibilidade: WhatsappDisponibilidade;
}
export type TipoEventoWhats =
  | "sessao_iniciada"
  | "qr_gerado"
  | "conectado"
  | "queda"
  | "sessao_encerrada";
export type StatusEventoWhats = "sucesso" | "aviso" | "erro";
export interface EventoWhats {
  id: string;
  tipo: TipoEventoWhats;
  status: StatusEventoWhats;
  timestamp: string;
}
export interface WhatsappOverview {
  status: WhatsAppStatus;
  qrImagem?: string;
  sessao: WhatsappSessao;
  kpis: WhatsappKpis;
  eventos: EventoWhats[];
}

export const whatsappApi = {
  status: () => req<WhatsAppStatusResp>("GET", "/status"),
  conectar: () => req<WhatsAppStatusResp>("POST", "/connect"),
  desconectar: () => req<unknown>("POST", "/logout"),
  enviarTeste: (numero: string) =>
    req<unknown>("POST", "/enviar-teste", { numero }),
  overview: () => req<WhatsappOverview>("GET", "/overview"),
};
