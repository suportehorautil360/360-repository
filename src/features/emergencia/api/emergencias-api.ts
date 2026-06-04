import { api } from "../../../lib/api/client";
import {
  emergencyFromUnknown,
  type CriarEmergenciaInput,
  type Emergencia,
  type EmergencyStatus,
} from "../domain";

interface RespLista {
  data: Record<string, unknown>[];
  message: string;
}

interface RespCriar {
  data: Record<string, unknown>;
  message: string;
}

export const emergenciasApi = {
  async listar(prefeituraId: string): Promise<Emergencia[]> {
    const r = await api.get<RespLista>(`/emergencies/${prefeituraId}`);
    return (r.data ?? []).map(emergencyFromUnknown);
  },

  async criar(input: CriarEmergenciaInput): Promise<Emergencia> {
    const r = await api.post<RespCriar>("/emergencies", input);
    return emergencyFromUnknown(r.data);
  },

  async atualizarStatus(id: string, status: EmergencyStatus): Promise<void> {
    await api.post(`/emergencies/${id}/status`, { status });
  },

  /**
   * Dispara a notificação de WhatsApp de uma emergência (best-effort). Usado
   * pelo checklist, que grava a emergência direto no Firestore — então o
   * gatilho do backend (no create) não roda e chamamos a notificação à parte.
   */
  async notificarWhatsApp(input: {
    prefeituraId: string;
    severity: string;
    chassis?: string | null;
    idMaquina?: string | null;
    tipoFalha: string;
    descricao: string;
    operadorNome?: string | null;
    localizacaoGps?: string | null;
    dataHoraIso: string;
    /** Fotos do impeditivo (data URL/base64) — enviadas como imagem no zap. */
    fotos?: string[] | null;
  }): Promise<void> {
    await api.post("/emergencies/notificar-whatsapp", input);
  },
};
