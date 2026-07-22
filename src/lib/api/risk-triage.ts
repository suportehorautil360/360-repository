/** Triagem de risco — `GET /risk-triage/prefeitura/:id` (NestJS). */

import { api } from "./client";

export type RiskTriageNivelApi = "alto" | "medio" | "baixo";

export interface RiskTriageRowApi {
  risco: RiskTriageNivelApi;
  nomeEquipamento: string;
  tipoEquipamento: string;
  chassis: string;
  defeito: string;
  nomeOperador: string;
  acaoSugerida: string;
}

type ListResponse = {
  data: RiskTriageRowApi[];
  message: string;
};

export function riskTriageNivelParaUi(
  nivel: RiskTriageNivelApi | string,
): "Alto" | "Médio" | "Baixo" {
  const n = String(nivel).trim().toLowerCase();
  if (n === "alto") return "Alto";
  if (n === "medio" || n === "médio") return "Médio";
  return "Baixo";
}

export const riskTriageApi = {
  async listarPorPrefeitura(
    prefeituraId: string,
  ): Promise<RiskTriageRowApi[]> {
    const body = await api.get<ListResponse>(
      `/risk-triage/prefeitura/${encodeURIComponent(prefeituraId)}`,
    );
    return body.data ?? [];
  },
};
