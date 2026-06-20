import type { EquipRow } from "./equipamentos/equipamentos-api";
import type { FiltrosOsLista, SolicitacaoOS } from "./abrir-os-model";
import {
  mensagemErroCriarOs as mensagemErroApi,
  osSolicitacoesApi,
  tipoOsParaServiceType,
  type WorkshopInvited,
} from "../../../lib/api/os-solicitacoes";

export type { WorkshopInvited };

export interface OficinaAtiva {
  id: string;
  nome: string;
  especialidade: string;
}

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

export function normEsp(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function linhaCompat(equipLine: string, oficinaEsp: string): boolean {
  const a = normEsp(equipLine);
  const b = normEsp(oficinaEsp);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Até 3 oficinas: match flexível por linha; fallback = todas ativas do município. (UI / testes) */
export function selecionarOficinas(
  oficinas: OficinaAtiva[],
  linhaEquipamento: string,
  max = 3,
): OficinaAtiva[] {
  if (oficinas.length === 0) return [];

  const linha = linhaEquipamento.trim();
  const matches = linha
    ? oficinas.filter((o) => linhaCompat(linha, o.especialidade))
    : [];
  const pool = matches.length > 0 ? matches : oficinas;
  return shuffle(pool).slice(0, max);
}

export function formatHorimetroEquipamento(eq: EquipRow): string {
  if (eq.medicaoAtual <= 0) return "";
  const u = eq.unidadeRevisao === "h" ? "h" : "km";
  return `${eq.medicaoAtual.toLocaleString("pt-BR")} ${u}`;
}

export function linhaDoEquipamento(eq: EquipRow): string {
  return (eq.linha || eq.tipo || "").trim();
}

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
  if (err instanceof CriarSolicitacaoOsError) return err.message;
  return mensagemErroApi(err);
}
