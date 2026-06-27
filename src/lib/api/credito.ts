/** Crédito de abastecimento — GET/POST /creditos (back-360). */
import { api } from "./client";
import type { Abastecimento } from "./abastecimentos";

export type CreditType = "equipment" | "workFront";
export type CreditoAlocacao = "equipamento" | "frente";

export interface CreditoOpcao {
  id: string;
  label: string;
}

export interface CreditoOpcoesTela {
  typeOptions: Array<{ value: CreditType; label: string }>;
  equipamentos: CreditoOpcao[];
  frentes: CreditoOpcao[];
  responsaveis: string[];
  suggestedAmounts: number[];
}

export interface SaldoEquipamentoTela {
  id: string;
  placa: string;
  nome: string;
  local: string;
  saldoLabel: string;
  creditadoLabel: string;
  gastoLabel: string;
}

export interface SaldoFrenteTela {
  id: string;
  nome: string;
  saldoLabel: string;
  creditadoLabel: string;
  gastoLabel: string;
}

export interface LancamentoCreditoTela {
  id: string;
  dataLabel: string;
  /** Data do lançamento em YYYY-MM-DD (fuso local) para filtro de período. */
  dataIso: string;
  createdAt: string;
  tipo: CreditoAlocacao;
  tipoApi: CreditType;
  tipoLabel: string;
  destino: string;
  amount: number;
  valorLabel: string;
  responsavel: string;
  observacao: string;
  /** Entrada de crédito (+) ou saída por abastecimento (−). */
  direcao: "entrada" | "saida";
}

export interface CreditoSaldosTela {
  saldosEquipamento: SaldoEquipamentoTela[];
  saldosFrente: SaldoFrenteTela[];
}

export interface CreditoResumoTela extends CreditoSaldosTela {
  periodoLabel: string;
  totalCreditadoLabel: string;
  qtdCreditosEquipamento: number;
  qtdCreditosFrente: number;
  historico: LancamentoCreditoTela[];
}

export interface LancarCreditoInput {
  alocacao: CreditoAlocacao;
  destinoId: string;
  valor: number;
  responsavel: string;
  observacao?: string;
}

interface CreditoFormOpcoesApi {
  typeOptions?: Array<{ value: CreditType; label: string }>;
  equipment?: Array<{ id: string; label: string }>;
  workFronts?: Array<{ id: string; label: string }>;
  responsibleOptions?: string[];
  suggestedAmounts?: number[];
}

interface CreditoListItemApi {
  id: string;
  type: CreditType;
  typeLabel?: string;
  targetLabel?: string;
  amount: number;
  amountLabel?: string;
  responsible?: string;
  observation?: string | null;
  createdAt?: string;
  dateLabel?: string;
}

interface CreditoCriadoApi extends CreditoListItemApi {
  prefeituraId?: string;
  equipmentId?: string | null;
  plateOrChassis?: string | null;
  workFrontId?: string | null;
}

interface SaldoEquipamentoApi {
  id: string;
  placa?: string;
  nome?: string;
  local?: string;
  saldo?: number;
  saldoLabel?: string;
  creditado?: number;
  creditadoLabel?: string;
  gasto?: number;
  gastoLabel?: string;
}

interface SaldoFrenteApi {
  id: string;
  nome?: string;
  saldo?: number;
  saldoLabel?: string;
  creditado?: number;
  creditadoLabel?: string;
  gasto?: number;
  gastoLabel?: string;
}

interface CreditoSaldosPayloadApi {
  saldosEquipamento?: SaldoEquipamentoApi[];
  saldosFrente?: SaldoFrenteApi[];
}

function fmtMoeda(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dataLabelDeIso(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/** YYYY-MM-DD em calendário local — usado no filtro de período da tela. */
function dataIsoDeCredito(createdAt?: string, dateLabel?: string): string {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(createdAt)) {
      return createdAt.slice(0, 10);
    }
  }
  const m = dateLabel?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function tipoApiParaTela(type: CreditType): CreditoAlocacao {
  return type === "equipment" ? "equipamento" : "frente";
}

function tipoLabelPadrao(type: CreditType): string {
  return type === "equipment" ? "Equipamento" : "Frente";
}

function itemApiParaTela(item: CreditoListItemApi): LancamentoCreditoTela {
  const amount = Number.isFinite(item.amount) ? item.amount : 0;
  return {
    id: item.id,
    dataLabel: item.dateLabel?.trim() || dataLabelDeIso(item.createdAt),
    dataIso: dataIsoDeCredito(item.createdAt, item.dateLabel),
    createdAt: item.createdAt ?? "",
    tipo: tipoApiParaTela(item.type),
    tipoApi: item.type,
    tipoLabel: item.typeLabel?.trim() || tipoLabelPadrao(item.type),
    destino: item.targetLabel?.trim() || "—",
    amount,
    valorLabel: item.amountLabel?.trim() || `+ ${fmtMoeda(amount)}`,
    responsavel: item.responsible?.trim() || "—",
    observacao: item.observation?.trim() || "—",
    direcao: "entrada",
  };
}

/** Abastecimento em posto credenciado → linha de saída no histórico de crédito. */
export function abastecimentoParaLancamento(item: Abastecimento): LancamentoCreditoTela | null {
  if (item.origem !== "posto" || item.valor <= 0) return null;

  const horaNorm = item.hora?.trim() || "12:00";
  const createdAt = item.data ? `${item.data}T${horaNorm}:00` : "";

  const destino = [item.placa, item.veiculo].filter(Boolean).join(" — ") || "—";
  const obsParts = [
    item.postoNome || item.local,
    item.litros > 0 ? `${item.litros} L` : "",
  ].filter(Boolean);

  const dataLabel = item.data
    ? (() => {
        const [y, m, d] = item.data.split("-");
        return y && m && d ? `${d}/${m}/${y}` : dataLabelDeIso(createdAt);
      })()
    : "—";

  return {
    id: `abast-${item.id}`,
    dataLabel,
    dataIso: item.data || dataIsoDeCredito(createdAt),
    createdAt,
    tipo: "equipamento",
    tipoApi: "equipment",
    tipoLabel: "Saída (posto)",
    destino,
    amount: -item.valor,
    valorLabel: `− ${fmtMoeda(item.valor)}`,
    responsavel: "—",
    observacao: obsParts.join(" · ") || "Abastecimento",
    direcao: "saida",
  };
}

export function mesclarHistoricoLancamentos(
  entradas: LancamentoCreditoTela[],
  abastecimentos: Abastecimento[],
): LancamentoCreditoTela[] {
  const saidas = abastecimentos
    .map(abastecimentoParaLancamento)
    .filter((item): item is LancamentoCreditoTela => item != null);

  return [...entradas, ...saidas].sort((a, b) => {
    const da = a.createdAt || a.dataIso;
    const db = b.createdAt || b.dataIso;
    return db.localeCompare(da);
  });
}

function opcoesApiParaTela(data: CreditoFormOpcoesApi): CreditoOpcoesTela {
  return {
    typeOptions: data.typeOptions ?? [
      { value: "equipment", label: "Equipamento" },
      { value: "workFront", label: "Frente de trabalho" },
    ],
    equipamentos: (data.equipment ?? []).map((e) => ({
      id: e.id,
      label: e.label,
    })),
    frentes: (data.workFronts ?? []).map((f) => ({
      id: f.id,
      label: f.label,
    })),
    responsaveis: data.responsibleOptions ?? ["Financeiro"],
    suggestedAmounts: data.suggestedAmounts ?? [200, 500, 1000, 2000, 5000],
  };
}

export function filtrarHistoricoPorPeriodo(
  historico: LancamentoCreditoTela[],
  inicio: string,
  fim: string,
): LancamentoCreditoTela[] {
  return historico.filter((item) => {
    const dia = item.dataIso;
    if (!dia) return true;
    return dia >= inicio && dia <= fim;
  });
}

function labelOuMoeda(label: string | undefined, valor: number | undefined): string {
  const t = label?.trim();
  if (t) return t;
  return fmtMoeda(Number.isFinite(valor) ? (valor as number) : 0);
}

function saldoEquipamentoParaTela(item: SaldoEquipamentoApi): SaldoEquipamentoTela {
  return {
    id: item.id,
    placa: item.placa?.trim() || "—",
    nome: item.nome?.trim() || "—",
    local: item.local?.trim() || "—",
    saldoLabel: labelOuMoeda(item.saldoLabel, item.saldo),
    creditadoLabel: labelOuMoeda(item.creditadoLabel, item.creditado),
    gastoLabel: labelOuMoeda(item.gastoLabel, item.gasto),
  };
}

function saldoFrenteParaTela(item: SaldoFrenteApi): SaldoFrenteTela {
  return {
    id: item.id,
    nome: item.nome?.trim() || "—",
    saldoLabel: labelOuMoeda(item.saldoLabel, item.saldo),
    creditadoLabel: labelOuMoeda(item.creditadoLabel, item.creditado),
    gastoLabel: labelOuMoeda(item.gastoLabel, item.gasto),
  };
}

function saldosPayloadParaTela(data: CreditoSaldosPayloadApi): CreditoSaldosTela {
  return {
    saldosEquipamento: (data.saldosEquipamento ?? []).map(saldoEquipamentoParaTela),
    saldosFrente: (data.saldosFrente ?? []).map(saldoFrenteParaTela),
  };
}

export function montarResumoCredito(
  historico: LancamentoCreditoTela[],
  periodoLabel: string,
  saldos: CreditoSaldosTela = { saldosEquipamento: [], saldosFrente: [] },
): CreditoResumoTela {
  const entradas = historico.filter((h) => h.direcao !== "saida");
  const total = entradas.reduce((s, h) => s + h.amount, 0);
  return {
    periodoLabel,
    totalCreditadoLabel: fmtMoeda(total),
    qtdCreditosEquipamento: entradas.filter((h) => h.tipo === "equipamento").length,
    qtdCreditosFrente: entradas.filter((h) => h.tipo === "frente").length,
    saldosEquipamento: saldos.saldosEquipamento,
    saldosFrente: saldos.saldosFrente,
    historico,
  };
}

function alocacaoParaType(alocacao: CreditoAlocacao): CreditType {
  return alocacao === "equipamento" ? "equipment" : "workFront";
}

export const creditoApi = {
  async obterOpcoes(prefeituraId: string): Promise<CreditoOpcoesTela> {
    const r = await api.get<{ data: CreditoFormOpcoesApi }>(
      `/creditos/opcoes/${prefeituraId}`,
    );
    return opcoesApiParaTela(r.data ?? {});
  },

  async listar(prefeituraId: string): Promise<LancamentoCreditoTela[]> {
    const r = await api.get<{ data: CreditoListItemApi[] }>(
      `/creditos/${prefeituraId}`,
    );
    return (r.data ?? []).map(itemApiParaTela);
  },

  async obterSaldos(prefeituraId: string): Promise<CreditoSaldosTela> {
    const r = await api.get<{ data: CreditoSaldosPayloadApi }>(
      `/creditos/saldos/${prefeituraId}`,
    );
    return saldosPayloadParaTela(r.data ?? {});
  },

  async lancar(
    prefeituraId: string,
    input: LancarCreditoInput,
  ): Promise<LancamentoCreditoTela> {
    const base = {
      prefeituraId,
      amount: input.valor,
      responsible: input.responsavel,
      ...(input.observacao?.trim()
        ? { observation: input.observacao.trim() }
        : {}),
    };

    const payload =
      input.alocacao === "equipamento"
        ? {
            ...base,
            type: "equipment" as const,
            plateOrChassis: input.destinoId.trim(),
          }
        : {
            ...base,
            type: "workFront" as const,
            workFrontId: input.destinoId,
          };

    const r = await api.post<{ data: CreditoCriadoApi }>("/creditos", payload);
    const criado = r.data;
    if (!criado?.id) {
      return itemApiParaTela({
        id: `tmp-${Date.now()}`,
        type: alocacaoParaType(input.alocacao),
        amount: input.valor,
        targetLabel: input.destinoId,
        responsible: input.responsavel,
        observation: input.observacao ?? null,
        createdAt: new Date().toISOString(),
      });
    }
    return itemApiParaTela(criado);
  },
};
