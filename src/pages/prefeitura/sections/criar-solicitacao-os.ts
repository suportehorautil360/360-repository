import type { EquipRow } from "./equipamentos/equipamentos-api";
import {
  filtrarOficinasElegiveis,
  linhaDoEquipamento,
  normEsp,
  especialidadeCompativel,
  type OficinaDirecionamento,
} from "./direcionamento-os";
import type { FiltrosOsLista, SolicitacaoOS } from "./abrir-os-model";
import {
  mensagemErroCriarOs as mensagemErroApi,
  osSolicitacoesApi,
  tipoOsParaServiceType,
  type WorkshopInvited,
} from "../../../lib/api/os-solicitacoes";

export type { WorkshopInvited };

/** Alias local — mantém o nome do domínio sem redeclarar os campos. */
export type OficinaAtiva = OficinaDirecionamento;

export interface CriarSolicitacaoOsInput {
  prefeituraId: string;
  equipamento: EquipRow;
  operador: string;
  relato: string;
  tipoOs?: string;
  cicloId?: string;
  dataAgendamento?: string;
}

export interface CriarSolicitacaoOsResult {
  id: string;
  protocolo: string;
  invitedWorkshops: WorkshopInvited[];
  status: string;
}

export class CriarSolicitacaoOsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriarSolicitacaoOsError";
  }
}

export {
  normEsp,
  especialidadeCompativel as linhaCompat,
  filtrarOficinasElegiveis,
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Até `max` oficinas elegíveis; sem `max`, retorna todas (pregão / abrir OS). */
export function selecionarOficinas(
  oficinas: OficinaAtiva[],
  linhaEquipamento: string,
  max?: number,
  segmento?: string,
): OficinaAtiva[] {
  const pool = filtrarOficinasElegiveis(oficinas, linhaEquipamento, segmento);
  if (pool.length === 0) return [];
  const ordenadas = shuffle(pool);
  if (max == null || max <= 0) return ordenadas;
  return ordenadas.slice(0, max);
}

export function formatHorimetroEquipamento(eq: EquipRow): string {
  if (eq.medicaoAtual <= 0) return "";
  const u = eq.unidadeRevisao === "h" ? "h" : "km";
  return `${eq.medicaoAtual.toLocaleString("pt-BR")} ${u}`;
}

export { linhaDoEquipamento };

export async function criarSolicitacaoOs(
  input: CriarSolicitacaoOsInput,
): Promise<CriarSolicitacaoOsResult> {
  const eq = input.equipamento;
  const linha = linhaDoEquipamento(eq);
  if (!linha) {
    throw new CriarSolicitacaoOsError(
      "Equipamento inválido ou sem linha cadastrada.",
    );
  }

  const resultado = await osSolicitacoesApi.criar({
    prefeituraId: input.prefeituraId.trim(),
    equipmentId: eq.id,
    operator: input.operador.trim(),
    report: input.relato.trim(),
    serviceType: tipoOsParaServiceType(input.tipoOs),
    scheduledDate: input.dataAgendamento?.trim() || undefined,
    cicloId: input.cicloId?.trim() || undefined,
  });

  return {
    id: resultado.id,
    protocolo: resultado.protocol,
    invitedWorkshops: resultado.invitedWorkshops,
    status: resultado.status,
  };
}

export async function listarSolicitacoesOs(
  prefeituraId: string,
  filtros?: FiltrosOsLista,
): Promise<SolicitacaoOS[]> {
  return osSolicitacoesApi.listar(prefeituraId, {
    status: filtros?.status,
    startDate: filtros?.dataInicio || undefined,
    endDate: filtros?.dataFim || undefined,
  });
}

export function mensagemErroCriarOs(err: unknown): string {
  return mensagemErroApi(err);
}
