/** Financeiro — contas a pagar e receber (/financeiro, NestJS). */
import { api } from "./client";

export type TipoLancamentoApi = "receita" | "despesa";
export type StatusLancamentoApi = "pago" | "pendente" | "atrasado";

export interface LancamentoApi {
  id: string;
  documento: string;
  tipo: TipoLancamentoApi;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusLancamentoApi;
}

export interface ResumoFinanceiroApi {
  receitas: number;
  despesas: number;
  saldo: number;
  total: number;
}

export interface FinanceiroOverviewApi {
  lancamentos: LancamentoApi[];
  resumo: ResumoFinanceiroApi;
}

export interface CriarLancamentoPayload {
  tipo: TipoLancamentoApi;
  status?: StatusLancamentoApi;
  descricao: string;
  valor: number;
  vencimento?: string;
}

const VAZIO: FinanceiroOverviewApi = {
  lancamentos: [],
  resumo: { receitas: 0, despesas: 0, saldo: 0, total: 0 },
};

export const financeiroApi = {
  async overview(): Promise<FinanceiroOverviewApi> {
    const r = await api.get<{ data: FinanceiroOverviewApi }>("/financeiro");
    return r.data ?? VAZIO;
  },

  async criar(payload: CriarLancamentoPayload): Promise<{ documento: string }> {
    const r = await api.post<{
      data: { id: string; documento: string };
      message: string;
    }>("/financeiro", payload);
    return { documento: r.data?.documento ?? "" };
  },

  async remover(id: string): Promise<void> {
    await api.del(`/financeiro/${id}`);
  },
};
