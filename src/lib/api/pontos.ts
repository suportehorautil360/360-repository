/**
 * API de ponto (módulo time-records do back-360-). Infra compartilhada:
 * consumida pelo operador (checklist) e pelo RH (portal da prefeitura).
 */
import { api } from "./client";

export type TipoPonto = "entrada" | "almoco" | "volta" | "saida";

export type StatusPonto = "pendente" | "aprovado" | "reprovado";

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
  status?: StatusPonto;
  motivoReprovacao?: string;
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

export const pontosApi = {
  async bater(input: BaterPontoInput): Promise<PontoRegistro> {
    const r = await api.post<RespostaCriar>("/time-records", input);
    return r.data;
  },

  async listar(prefeituraId: string): Promise<PontoRegistro[]> {
    const r = await api.get<RespostaLista>(`/time-records/${prefeituraId}`);
    return r.data;
  },

  /**
   * Corrige o horário de uma batida (operador). A correção fica pendente de
   * aprovação do gestor. `motivo` é opcional e acompanha a solicitação.
   */
  async editarHorario(
    id: string,
    timestampOriginal: string,
    motivo?: string,
  ): Promise<void> {
    await api.post(`/time-records/update/${id}`, {
      timestampOriginal,
      ...(motivo?.trim() ? { motivo: motivo.trim() } : {}),
    });
  },

  /** Aprova uma batida (RH). */
  async aprovar(id: string): Promise<void> {
    await api.post(`/time-records/${id}/aprovar`);
  },

  /** Reprova uma batida com motivo (RH). */
  async reprovar(id: string, motivo: string): Promise<void> {
    await api.post(`/time-records/${id}/reprovar`, { motivo });
  },
};
