import { api } from "../../../lib/api/client";

export type ChecklistItemSeveridade = "impeditivo" | "normal";

export interface ChecklistDefinitionItem {
  ordem: number;
  texto: string;
  severidade: ChecklistItemSeveridade;
}

export interface ChecklistDefinition {
  id: string;
  nome: string;
  categoria: string;
  keywords: string[];
  ativo: boolean;
  version: number;
  itens: ChecklistDefinitionItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistDefinitionInput {
  nome: string;
  categoria: string;
  keywords: string[];
  itens: ChecklistDefinitionItem[];
  ativo?: boolean;
}

interface RespList {
  data: ChecklistDefinition[];
  message: string;
}
interface RespOne {
  data: ChecklistDefinition;
  message: string;
}

/**
 * Cliente da API do catálogo GLOBAL de definições de checklist (NestJS).
 * Fonte da verdade dos checklists do operador — substitui o seed hardcoded.
 */
export const checklistDefinitionsApi = {
  async listar(somenteAtivas = false): Promise<ChecklistDefinition[]> {
    const qs = somenteAtivas ? "?ativo=true" : "";
    const r = await api.get<RespList>(`/checklist-definitions${qs}`);
    return r.data;
  },

  async obter(id: string): Promise<ChecklistDefinition> {
    const r = await api.get<RespOne>(`/checklist-definitions/${id}`);
    return r.data;
  },

  async criar(input: ChecklistDefinitionInput): Promise<ChecklistDefinition> {
    const r = await api.post<RespOne>("/checklist-definitions", input);
    return r.data;
  },

  async atualizar(
    id: string,
    input: Partial<ChecklistDefinitionInput>,
  ): Promise<ChecklistDefinition> {
    const r = await api.patch<RespOne>(`/checklist-definitions/${id}`, input);
    return r.data;
  },

  async remover(id: string) {
    return api.del(`/checklist-definitions/${id}`);
  },

  async seed() {
    return api.post("/checklist-definitions/seed");
  },
};
