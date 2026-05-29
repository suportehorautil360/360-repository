import type { Emergencia, EmergencyStatus } from "./types";

export function normalizeEmergencyStatus(value: unknown): EmergencyStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "resolvido") return "RESOLVIDO";
  if (s === "em_atendimento" || s === "em atendimento")
    return "EM_ATENDIMENTO";
  if (s === "cancelado") return "CANCELADO";
  return "ABERTO";
}

export function emergencyStatusLabel(status: EmergencyStatus): string {
  if (status === "RESOLVIDO") return "Resolvido";
  if (status === "EM_ATENDIMENTO") return "Em atendimento";
  if (status === "CANCELADO") return "Cancelado";
  return "Aberto";
}

export function emergencyFromUnknown(input: Record<string, unknown>): Emergencia {
  const fotos = Array.isArray(input.fotos)
    ? input.fotos.filter((foto): foto is string => typeof foto === "string")
    : [];
  const id = String(input.id ?? input._docId ?? "");
  return {
    id,
    prefeituraId: String(input.prefeituraId ?? ""),
    source:
      input.source === "checklist_auto" || input.source === "manual"
        ? input.source
        : "manual",
    severity:
      input.severity === "warning" ||
      input.severity === "critical" ||
      input.severity === "blocking"
        ? input.severity
        : "critical",
    chassis: String(input.chassis ?? ""),
    dataHoraIso:
      typeof input.dataHoraIso === "string"
        ? input.dataHoraIso
        : typeof input.Data_Hora === "string"
          ? input.Data_Hora
          : null,
    descricao: String(input.descricao ?? input.Descricao_Curta ?? "—"),
    fotos,
    equipamentoId: String(input.equipamentoId ?? input.idMaquina ?? ""),
    idMaquina: String(input.idMaquina ?? input.equipamentoId ?? "—"),
    localizacaoGps:
      typeof input.localizacaoGps === "string"
        ? input.localizacaoGps
        : typeof input.Localizacao_GPS === "string"
          ? input.Localizacao_GPS
          : null,
    operadorNome: String(input.operadorNome ?? input.operador ?? "—"),
    operador: String(input.operador ?? input.operadorNome ?? "—"),
    qtdFotos: Number(input.qtdFotos ?? input.Qtd_Fotos_Evidencia ?? fotos.length),
    statusAtendimento: normalizeEmergencyStatus(
      input.statusAtendimento ?? input.Status_Atendimento,
    ),
    tipoFalha: String(input.tipoFalha ?? input.Tipo_Falha ?? "—"),
    checklistRunId:
      typeof input.checklistRunId === "string" ? input.checklistRunId : null,
    questionId: typeof input.questionId === "string" ? input.questionId : null,
    questionLabel:
      typeof input.questionLabel === "string" ? input.questionLabel : null,
  };
}
