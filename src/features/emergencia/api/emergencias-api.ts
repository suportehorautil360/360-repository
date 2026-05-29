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
};
