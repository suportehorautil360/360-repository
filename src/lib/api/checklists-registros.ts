/** Checklists de operador (PWA) — coleção `checklistsRegistros` via NestJS. */

import { api } from "./client";

export interface ChecklistRegistroItemNaoApi {
  titulo?: string;
}

export interface ChecklistRegistroApi {
  id: string;
  dataHoraIso: string;
  operador: string;
  chassis: string;
  categoria: string;
  modelo: string;
  linha: string;
  totalItens: number;
  totalSim: number;
  pontuacao: number;
  horimetro: string;
  assinaturaOperador: string;
  respostas: Record<string, unknown> | string;
  obs: string | null;
  localizacaoGps: unknown;
  prefeituraId: string;
  idOperadorSession: string;
  itensNao: ChecklistRegistroItemNaoApi[];
}

export interface TopOperadorChecklistApi {
  nome: string;
  total: number;
}

export interface ChecklistRegistroResumoPainelApi {
  mes: string;
  totalGeral: number;
  totalNoMes: number;
  checklistsPorSemana: number[];
  topOperadores: TopOperadorChecklistApi[];
}

type ListResponse = {
  data: ChecklistRegistroApi[];
  message: string;
};

type TopOperadoresResponse = {
  data: { mes: string; operadores: TopOperadorChecklistApi[] };
  message: string;
};

type ResumoPainelResponse = {
  data: ChecklistRegistroResumoPainelApi;
  message: string;
};

export function checklistRegistroParaAuditoriaRow(
  doc: ChecklistRegistroApi,
): Record<string, unknown> {
  const respostasJson =
    doc.respostas && typeof doc.respostas === "object"
      ? JSON.stringify(doc.respostas)
      : typeof doc.respostas === "string"
        ? doc.respostas
        : "{}";

  return {
    ID_Registro: doc.id,
    Data_Hora: doc.dataHoraIso,
    Operador: doc.operador,
    Chassis: doc.chassis,
    Categoria: doc.categoria,
    Modelo: doc.modelo,
    Linha: doc.linha,
    Item_Verificado: `Checklist ${doc.totalItens || "?"} itens`,
    Status_Ok_Nao: `${doc.totalSim}/${doc.totalItens || 0} OK`,
    Respostas_JSON: respostasJson,
    Horimetro_Final: doc.horimetro,
    Assinatura_Operador: doc.assinaturaOperador,
    Pontuacao: doc.pontuacao,
    ID_Cliente: doc.idOperadorSession,
    prefeituraId: doc.prefeituraId,
    Localizacao_GPS: doc.localizacaoGps ?? null,
    Obs: doc.obs ?? null,
  };
}

export const checklistsRegistrosApi = {
  async listarPorPrefeitura(
    prefeituraId: string,
  ): Promise<ChecklistRegistroApi[]> {
    const body = await api.get<ListResponse>(
      `/checklists-registros/prefeitura/${encodeURIComponent(prefeituraId)}`,
    );
    return body.data ?? [];
  },

  async topOperadores(
    prefeituraId: string,
    mes?: string,
    limite = 5,
  ): Promise<TopOperadoresResponse["data"]> {
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    if (limite !== 5) params.set("limite", String(limite));

    const query = params.toString();
    const body = await api.get<TopOperadoresResponse>(
      `/checklists-registros/prefeitura/${encodeURIComponent(prefeituraId)}/top-operadores${query ? `?${query}` : ""}`,
    );
    return body.data;
  },

  async resumoPainel(
    prefeituraId: string,
    mes?: string,
  ): Promise<ChecklistRegistroResumoPainelApi> {
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    const query = params.toString();

    const body = await api.get<ResumoPainelResponse>(
      `/checklists-registros/prefeitura/${encodeURIComponent(prefeituraId)}/resumo-painel${query ? `?${query}` : ""}`,
    );
    return body.data;
  },
};
