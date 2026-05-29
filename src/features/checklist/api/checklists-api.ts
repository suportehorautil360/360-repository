import { api } from "../../../lib/api/client";

export type ChecklistRunStatus = "in_progress" | "blocked" | "completed";

export interface CriarChecklistRunInput {
  prefeituraId: string;
  definitionId?: string;
  definitionVersion?: number;
  equipamentoId: string;
  chassis: string;
  operadorNome: string;
  categoria?: string;
}

export interface ChecklistRun {
  id: string;
  prefeituraId: string;
  definitionId?: string | null;
  definitionVersion: number;
  equipamentoId: string;
  chassis: string;
  operadorNome: string;
  categoria?: string | null;
  status: ChecklistRunStatus;
  generatedEmergencyIds: string[];
  startedAt: string;
  updatedAt: string;
}

export type ChecklistRuleAction =
  | {
      type: "CREATE_EMERGENCY";
      severity?: "warning" | "critical" | "blocking";
      failureType: string;
      description?: string;
    }
  | { type: "BLOCK_OPERATION"; reason: string };

export interface ResponderChecklistInput {
  questionId: string;
  questionLabel?: string;
  value: unknown;
  problemDescription?: string;
  photoUrls?: string[];
  actions?: ChecklistRuleAction[];
}

interface RespRun {
  data: ChecklistRun;
  message: string;
}

export const checklistsApi = {
  async iniciar(input: CriarChecklistRunInput): Promise<ChecklistRun> {
    const r = await api.post<RespRun>("/checklists/runs", input);
    return r.data;
  },

  async responder(runId: string, input: ResponderChecklistInput) {
    return api.post(`/checklists/runs/${runId}/answers`, input);
  },
};
