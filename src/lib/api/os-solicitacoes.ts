/**

 * API de solicitações de O.S. (Fase 1) — back-360 POST/GET /os/solicitacoes.

 */

import type { FiltroStatusOs, SolicitacaoOS } from "../../pages/prefeitura/sections/abrir-os-model";

import { ApiError, api } from "./client";



export type ServiceTypeOs = "corrective" | "preventive" | "predictive";



export interface CriarSolicitacaoOsInput {

  prefeituraId: string;

  equipmentId: string;

  operator: string;

  report: string;

  serviceType?: ServiceTypeOs;

  scheduledDate?: string;

  cicloId?: string;

}



export interface WorkshopInvited {

  id: string;

  name: string;

}



export interface CriarSolicitacaoOsResult {

  id: string;

  protocol: string;

  serviceType: ServiceTypeOs;

  serviceTypeLabel?: string;

  invitedWorkshops: WorkshopInvited[];

  status: string;

}



export interface ListarSolicitacoesOsFiltros {

  status?: FiltroStatusOs | "aguardando_aprovacao" | "concluido";

  startDate?: string;

  endDate?: string;

}



/** Item bruto da API (campos EN + PT de compatibilidade). */

export interface SolicitacaoOsApi {

  id: string;

  protocol?: string;

  protocolo?: string;

  equipment?: string;

  equipamento?: string;

  line?: string;

  linha?: string;

  operator?: string;

  operador?: string;

  report?: string;

  relato?: string;

  serviceType?: ServiceTypeOs;

  serviceTypeLabel?: string;

  status: string;

  statusLabel?: string;

  dateLabel?: string;

  scheduledDate?: string;

  dataAgendamento?: string;

  horimetro?: string;

  equipamentoId?: string;

  equipmentId?: string;

  cicloId?: string;

  oficinasResponderam?: string[];

  workshopsResponded?: string[];

  invitedCount?: number;

  createdAt?: string;

  criadoEm?: { seconds: number } | null;

  workshops?: string[];

  oficinas?: string[];

  workshopIds?: string[];

  oficinasIds?: string[];

}



interface RespCriar {

  data: CriarSolicitacaoOsResult;

  message: string;

}



interface RespListar {

  data: SolicitacaoOsApi[];

  message: string;

}



/** Converte código do form (`C`/`P`/`V`) para `serviceType` da API. */

export function tipoOsParaServiceType(tipoOs?: string): ServiceTypeOs {

  const t = tipoOs?.toUpperCase();

  if (t === "V") return "preventive";

  if (t === "P") return "predictive";

  return "corrective";

}



export function mensagemErroCriarOs(err: unknown): string {

  if (err instanceof ApiError) {

    if (err.status === 400) {

      return "Equipamento inválido ou sem linha cadastrada.";

    }

    if (err.status === 404) {

      return "Equipamento não encontrado.";

    }

    if (err.status === 422) {

      return "Nenhuma oficina credenciada para este município.";

    }

  }

  return "Erro ao criar O.S. Tente novamente.";

}



export function solicitacaoApiParaTela(item: SolicitacaoOsApi): SolicitacaoOS {

  let criadoEm = item.criadoEm ?? null;

  if (!criadoEm?.seconds && item.createdAt) {

    const ms = new Date(item.createdAt).getTime();

    if (!Number.isNaN(ms)) {

      criadoEm = { seconds: Math.floor(ms / 1000) };

    }

  }



  const oficinasIds = item.oficinasIds ?? item.workshopIds;
  const oficinas = item.oficinas ?? item.workshops;
  const convidadas =
    item.invitedCount ??
    oficinasIds?.length ??
    oficinas?.length ??
    undefined;

  return {
    id: item.id,
    protocolo: item.protocolo ?? item.protocol ?? "",
    equipamentoId: item.equipamentoId ?? item.equipmentId,
    equipamento: item.equipamento ?? item.equipment ?? "",
    linha: item.linha ?? item.line ?? "",
    operador: item.operador ?? item.operator ?? "",
    relato: item.relato ?? item.report ?? "",
    status: item.status,
    criadoEm,
    serviceType: item.serviceType,
    serviceTypeLabel: item.serviceTypeLabel,
    dataAgendamento:
      item.dataAgendamento ?? item.scheduledDate ?? item.dateLabel,
    horimetro: item.horimetro,
    cicloId: item.cicloId,
    oficinas,
    oficinasIds,
    oficinasResponderam:
      item.oficinasResponderam ?? item.workshopsResponded,
    convidadas,
  };
}



function queryListar(filtros?: ListarSolicitacoesOsFiltros): string {

  const params = new URLSearchParams();

  if (filtros?.status && filtros.status !== "todos") {

    params.set("status", filtros.status);

  }

  if (filtros?.startDate) params.set("startDate", filtros.startDate);

  if (filtros?.endDate) params.set("endDate", filtros.endDate);

  const qs = params.toString();

  return qs ? `?${qs}` : "";

}



export const osSolicitacoesApi = {

  async criar(input: CriarSolicitacaoOsInput): Promise<CriarSolicitacaoOsResult> {

    const body: Record<string, string> = {

      prefeituraId: input.prefeituraId,

      equipmentId: input.equipmentId,

      operator: input.operator,

      report: input.report.trim(),

      serviceType: input.serviceType ?? "corrective",

    };

    if (input.scheduledDate) body.scheduledDate = input.scheduledDate;

    if (input.cicloId) body.cicloId = input.cicloId;



    const r = await api.post<RespCriar>("/os/solicitacoes", body);

    return r.data;

  },



  async listar(

    prefeituraId: string,

    filtros?: ListarSolicitacoesOsFiltros,

  ): Promise<SolicitacaoOS[]> {

    const r = await api.get<RespListar>(

      `/os/solicitacoes/${encodeURIComponent(prefeituraId)}${queryListar(filtros)}`,

    );

    return r.data.map(solicitacaoApiParaTela);

  },

};


