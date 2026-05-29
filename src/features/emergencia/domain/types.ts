export type EmergencyStatus =
  | "ABERTO"
  | "EM_ATENDIMENTO"
  | "RESOLVIDO"
  | "CANCELADO";

export type EmergencySource = "manual" | "checklist_auto";
export type EmergencySeverity = "warning" | "critical" | "blocking";

export interface Emergencia {
  id: string;
  prefeituraId: string;
  source: EmergencySource;
  severity: EmergencySeverity;
  chassis: string;
  dataHoraIso: string | null;
  descricao: string;
  fotos: string[];
  equipamentoId: string;
  idMaquina: string;
  localizacaoGps: string | null;
  operadorNome: string;
  operador: string;
  qtdFotos: number;
  statusAtendimento: EmergencyStatus;
  tipoFalha: string;
  checklistRunId?: string | null;
  questionId?: string | null;
  questionLabel?: string | null;
}

export interface CriarEmergenciaInput {
  prefeituraId: string;
  source?: EmergencySource;
  severity?: EmergencySeverity;
  equipamentoId?: string;
  chassis?: string;
  operadorNome: string;
  tipoFalha: string;
  descricao: string;
  localizacaoGps?: string | null;
  fotos?: string[];
  checklistRunId?: string | null;
  checklistId?: string | null;
  questionId?: string | null;
  questionLabel?: string | null;
  answerValue?: unknown;
}
