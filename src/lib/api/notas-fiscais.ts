/** Notas fiscais de combustível dos postos — endpoints /notas-fiscais do back. */
import { api } from "./client";

export type NotaStatus = "pendente" | "aprovada" | "rejeitada";
export type NotaDocumentType = "nfe-55" | "nfce-65";
export type NotaCategory = "servico" | "peca" | "combustivel" | "outros";

export interface NotaFiscal {
  id: string;
  postoId?: string;
  prefeituraId?: string;
  description: string;
  category: NotaCategory;
  documentType: NotaDocumentType;
  number: string;
  issuerName: string;
  issuedAt: string;
  accessKey: string;
  value: number;
  status: NotaStatus;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  parseCompleteness?: "completo" | "parcial";
}

export const STATUS_LABEL: Record<NotaStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export function documentoLabel(t: NotaDocumentType): string {
  return t === "nfce-65" ? "NFC-e" : "NF-e";
}

export const notasFiscaisApi = {
  /** Notas de combustível dos postos da prefeitura (mais recentes primeiro). */
  async listar(prefeituraId: string): Promise<NotaFiscal[]> {
    const r = await api.get<{ data: NotaFiscal[] }>(
      `/notas-fiscais/prefeitura/${encodeURIComponent(prefeituraId)}`,
    );
    return r.data ?? [];
  },

  /** Aprova ou rejeita uma nota. */
  async atualizarStatus(id: string, status: NotaStatus): Promise<void> {
    await api.patch(`/notas-fiscais/${encodeURIComponent(id)}/status`, {
      status,
    });
  },
};
