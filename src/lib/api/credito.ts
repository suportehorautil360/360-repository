/** Crédito de abastecimento — GET/POST /credito/:prefeituraId (quando disponível). */
import { api } from "./client";

export type CreditoAlocacao = "equipamento" | "frente";

export interface CreditoOpcao {
  id: string;
  label: string;
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
  tipo: CreditoAlocacao;
  tipoLabel: string;
  destino: string;
  valorLabel: string;
  responsavel: string;
  observacao: string;
}

export interface CreditoTela {
  periodoLabel: string;
  totalCreditadoLabel: string;
  qtdCreditosEquipamento: number;
  qtdCreditosFrente: number;
  saldosEquipamento: SaldoEquipamentoTela[];
  saldosFrente: SaldoFrenteTela[];
  historico: LancamentoCreditoTela[];
  equipamentos: CreditoOpcao[];
  frentes: CreditoOpcao[];
  responsaveis: string[];
}

export interface LancarCreditoInput {
  alocacao: CreditoAlocacao;
  destinoId: string;
  valor: number;
  responsavel: string;
  observacao?: string;
}

/** Payload bruto esperado do backend. */
interface CreditoPayloadApi {
  periodoLabel?: string;
  totalCreditadoLabel?: string;
  qtdCreditosEquipamento?: number;
  qtdCreditosFrente?: number;
  saldosEquipamento?: SaldoEquipamentoTela[];
  saldosFrente?: SaldoFrenteTela[];
  historico?: LancamentoCreditoTela[];
  equipamentos?: CreditoOpcao[];
  frentes?: CreditoOpcao[];
  responsaveis?: string[];
}

function addDaysIso(iso: string, days: number): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function payloadParaTela(payload: CreditoPayloadApi): CreditoTela {
  return {
    periodoLabel: payload.periodoLabel?.trim() ?? "",
    totalCreditadoLabel: payload.totalCreditadoLabel?.trim() ?? "R$ 0,00",
    qtdCreditosEquipamento: payload.qtdCreditosEquipamento ?? 0,
    qtdCreditosFrente: payload.qtdCreditosFrente ?? 0,
    saldosEquipamento: payload.saldosEquipamento ?? [],
    saldosFrente: payload.saldosFrente ?? [],
    historico: payload.historico ?? [],
    equipamentos: payload.equipamentos ?? [],
    frentes: payload.frentes ?? [],
    responsaveis: payload.responsaveis ?? ["Financeiro"],
  };
}

/** Dados de demonstração até o endpoint estar disponível. */
export function creditoDadosMock(): CreditoTela {
  return {
    periodoLabel: "",
    totalCreditadoLabel: "R$ 5.300,00",
    qtdCreditosEquipamento: 2,
    qtdCreditosFrente: 2,
    saldosEquipamento: [
      {
        id: "eq-1",
        placa: "STR-004",
        nome: "Strada Fretamento",
        local: "Apoio Campo",
        saldoLabel: "R$ 325,44",
        creditadoLabel: "R$ 500,00",
        gastoLabel: "R$ 174,56",
      },
      {
        id: "eq-2",
        placa: "HIL-012",
        nome: "Hilux Cabine Dupla",
        local: "Administrativo",
        saldoLabel: "R$ 217,90",
        creditadoLabel: "R$ 400,00",
        gastoLabel: "R$ 182,10",
      },
    ],
    saldosFrente: [
      {
        id: "fr-1",
        nome: "Apoio Campo",
        saldoLabel: "R$ 427,44",
        creditadoLabel: "R$ 1.500,00",
        gastoLabel: "R$ 1.072,56",
      },
      {
        id: "fr-2",
        nome: "Administrativo",
        saldoLabel: "R$ 1.300,00",
        creditadoLabel: "R$ 2.000,00",
        gastoLabel: "R$ 700,00",
      },
    ],
    historico: [
      {
        id: "1",
        dataLabel: "28/05/2026",
        tipo: "frente",
        tipoLabel: "Frente",
        destino: "Apoio Campo",
        valorLabel: "+R$ 1.000,00",
        responsavel: "Financeiro",
        observacao: "Previsão maio",
      },
      {
        id: "2",
        dataLabel: "27/05/2026",
        tipo: "equipamento",
        tipoLabel: "Equipamento",
        destino: "ABC-1234 — Escavadeira CAT 320",
        valorLabel: "+R$ 500,00",
        responsavel: "Financeiro",
        observacao: "—",
      },
      {
        id: "3",
        dataLabel: "27/05/2026",
        tipo: "frente",
        tipoLabel: "Frente",
        destino: "Administrativo",
        valorLabel: "+R$ 2.000,00",
        responsavel: "Gestor",
        observacao: "Crédito mensal",
      },
      {
        id: "4",
        dataLabel: "26/05/2026",
        tipo: "equipamento",
        tipoLabel: "Equipamento",
        destino: "STR-004 — Strada Fretamento",
        valorLabel: "+R$ 500,00",
        responsavel: "Financeiro",
        observacao: "—",
      },
    ],
    equipamentos: [
      {
        id: "eq-1",
        label: "STR-004 — Strada Fretamento | Apoio Campo",
      },
      {
        id: "eq-2",
        label: "HIL-012 — Hilux Cabine Dupla | Administrativo",
      },
      {
        id: "eq-3",
        label: "ABC-1234 — Escavadeira CAT 320 | Talhão Norte",
      },
    ],
    frentes: [
      { id: "fr-1", label: "Apoio Campo" },
      { id: "fr-2", label: "Administrativo" },
    ],
    responsaveis: ["Financeiro", "Gestor", "Diretoria"],
  };
}

export const creditoApi = {
  async listarPorPeriodo(
    prefeituraId: string,
    startDate: string,
    endDateInclusive: string,
  ): Promise<CreditoTela> {
    const endDateApi = addDaysIso(endDateInclusive, 1);
    const qs = new URLSearchParams({ startDate, endDate: endDateApi });
    try {
      const r = await api.get<{ data: CreditoPayloadApi }>(
        `/credito/${prefeituraId}?${qs}`,
      );
      return payloadParaTela(r.data ?? {});
    } catch {
      return creditoDadosMock();
    }
  },

  async lancar(
    prefeituraId: string,
    input: LancarCreditoInput,
  ): Promise<void> {
    await api.post(`/credito/${prefeituraId}`, input);
  },
};
