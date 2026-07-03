/** Checklists de devolução (CHD) — coleção `checklistsDevolucao` via NestJS. */

import { ApiError, api } from "./client";



export type ChdStatus =

  | "enviado"

  | "em_conferencia"

  | "aceito"

  | "contestado"

  | string;



export interface ChdIdentificationApi {

  os?: string;

  date?: string;

  time?: string;

  brandModel?: string;

  platePrefix?: string;

  currentKm?: string;

  hourMeter?: string;

  driver?: string;

  technicalResponsible?: string;

  fuel?: string;

}



export interface ChdStateItemApi {

  status?: string;

  photo?: string;

}



export interface ChdPartItemApi {

  description?: string;

  partNumber?: string;

  brand?: string;

  oldPartDestination?: string;

  newPhoto?: string;

  replacedPhoto?: string;

}



export interface ChdServiceItemApi {

  systemComponent?: string;

  initialDiagnosis?: string;

  technicalAction?: string;

  technician?: string;

  manHours?: string;

}



export interface ChdClosingApi {

  inventoryChecked?: boolean;

  driverSignature?: string;

  workshopSignature?: string;

}



export interface ChdDocApi {

  id: string;

  number: string;

  oficinaId: string;

  prefeituraId?: string | null;

  solicitacaoOsId?: string | null;

  identification: ChdIdentificationApi;

  parts?: { items?: ChdPartItemApi[] };

  services?: { items?: ChdServiceItemApi[] };

  status: ChdStatus;

  createdAt: string;

}



export interface ChdDocCompleto extends ChdDocApi {

  generalState?: Record<string, ChdStateItemApi>;

  modules?: Record<string, ChdStateItemApi>;

  closing?: ChdClosingApi;

  updatedAt?: string;

}



interface RespListarChd {

  data: ChdDocApi[];

  message: string;

}



interface RespObterChd {

  data: ChdDocCompleto;

  message: string;

}



export function mensagemErroChd(err: unknown): string {

  if (err instanceof ApiError && err.status === 404) {

    return "Checklist de devolução não encontrado.";

  }

  return "Não foi possível carregar o checklist de devolução (CHD).";

}



export const checklistDevolucaoApi = {

  async listarPorPrefeitura(prefeituraId: string): Promise<ChdDocApi[]> {

    const r = await api.get<RespListarChd>(

      `/checklist-devolucao/prefeitura/${encodeURIComponent(prefeituraId)}`,

    );

    return r.data ?? [];

  },



  async obterPorId(id: string): Promise<ChdDocCompleto> {

    const r = await api.get<RespObterChd>(

      `/checklist-devolucao/${encodeURIComponent(id)}`,

    );

    if (!r.data) {

      throw new ApiError(404, "Checklist não encontrado.");

    }

    return r.data;

  },

};


