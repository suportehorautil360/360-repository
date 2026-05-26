/** Chamadas ao backend de ponto (módulo time-records do back-360-). */
import { api } from "../../lib/api/client";

export type TipoPonto = "entrada" | "almoco" | "volta" | "saida";

/** Ordem e rótulos da folha do dia. */
export const TIPOS_PONTO: { tipo: TipoPonto; label: string }[] = [
  { tipo: "entrada", label: "Entrada" },
  { tipo: "almoco", label: "Saída p/ almoço" },
  { tipo: "volta", label: "Volta do almoço" },
  { tipo: "saida", label: "Saída" },
];

export interface BaterPontoInput {
  name: string;
  /** Foto (selfie) como data URL base64. */
  photo: string;
  prefeituraId: string;
  /** Horário da batida no dispositivo (ISO 8601). */
  timestampOriginal: string;
  tipo: TipoPonto;
}

export interface PontoRegistro {
  id: string;
  name: string;
  prefeituraId: string;
  timestampOriginal: string;
  tipo: TipoPonto;
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

  /** Edita apenas o horário de uma batida. */
  async editarHorario(id: string, timestampOriginal: string): Promise<void> {
    await api.post(`/time-records/update/${id}`, { timestampOriginal });
  },
};
