/** Chamadas ao backend de ponto (módulo time-records do back-360-). */
import { api } from "../../lib/api/client";

export interface BaterPontoInput {
  name: string;
  /** Foto (selfie) como data URL base64. */
  photo: string;
  prefeituraId: string;
  /** Horário da batida no dispositivo (ISO 8601). */
  timestampOriginal: string;
}

export interface PontoRegistro {
  id: string;
  name: string;
  prefeituraId: string;
  timestampOriginal: string;
  photo?: string;
  createdAt?: string;
}

interface RespostaLista {
  data: PontoRegistro[];
  message: string;
}

interface RespostaCriar {
  data: PontoRegistro;
  message: string;
}

export const pontoApi = {
  async bater(input: BaterPontoInput): Promise<PontoRegistro> {
    const r = await api.post<RespostaCriar>("/time-records", input);
    return r.data;
  },

  async listar(prefeituraId: string): Promise<PontoRegistro[]> {
    const r = await api.get<RespostaLista>(`/time-records/${prefeituraId}`);
    return r.data;
  },
};
