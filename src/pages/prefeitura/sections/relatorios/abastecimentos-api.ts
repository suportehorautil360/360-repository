/**
 * Camada de dados de Abastecimentos — backend NestJS (`/abastecimentos`).
 */
import { api, ApiError } from "../../../../lib/api/client";
import type { AbastecimentoRegistro } from "../../../../lib/hu360/types";

interface ListaResponse {
  data: Array<Partial<AbastecimentoRegistro> & { id?: string }>;
  message: string;
}

function asText(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(asText(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizar(d: Record<string, unknown>): AbastecimentoRegistro {
  return {
    id: asText(d.id),
    data: asText(d.data),
    hora: asText(d.hora),
    veiculo: asText(d.veiculo),
    placa: asText(d.placa),
    motorista: asText(d.motorista),
    secretaria: asText(d.secretaria),
    postoId: asText(d.postoId),
    postoNome: asText(d.postoNome),
    litros: asNumber(d.litros),
    valorTotal: asText(d.valorTotal),
    km: asNumber(d.km),
    combustivel: asText(d.combustivel),
    cupomFiscal: asText(d.cupomFiscal),
  };
}

export const abastecimentosApi = {
  /** Lista os abastecimentos da prefeitura (404 → lista vazia). */
  async listar(prefeituraId: string): Promise<AbastecimentoRegistro[]> {
    try {
      const r = await api.get<ListaResponse>(`/abastecimentos/${prefeituraId}`);
      return (r.data ?? []).map((d) =>
        normalizar(d as Record<string, unknown>),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  },
};
